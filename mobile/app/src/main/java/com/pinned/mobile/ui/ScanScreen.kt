package com.pinned.mobile.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.pinned.mobile.sync.PairingCodec
import com.pinned.mobile.sync.PairingInfo
import com.pinned.mobile.ui.components.GhostButton
import com.pinned.mobile.ui.theme.PinnedTheme
import java.util.concurrent.Executors

/**
 * Points the back camera at the QR code the desktop shows under "Sync Phone".
 * Anything that isn't a valid pairing payload is ignored silently so the scanner
 * keeps looking rather than bouncing the user out on a stray barcode.
 */
@Composable
fun ScanScreen(
    onCancel: () -> Unit,
    onScanned: (PairingInfo) -> Unit,
) {
    val c = PinnedTheme.colors
    val context = LocalContext.current

    var granted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    var denied by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { result ->
        granted = result
        denied = !result
    }

    LaunchedEffect(Unit) {
        if (!granted) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (granted) {
            CameraViewfinder(onQrDecoded = { raw ->
                PairingCodec.parse(raw)?.let(onScanned)
            })
            // Vignette dimming outside the reticle region.
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.55f),
                            ),
                            radius = 900f,
                        ),
                    ),
            )
            Reticle()
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp),
            ) {
                Text(
                    text = if (denied) {
                        "Camera access is off. Enable it in system settings to scan the pairing code."
                    } else {
                        "Waiting for camera permission…"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = c.textSecondary,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(20.dp))
                GhostButton(label = "Back", onClick = onCancel)
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Cancel scanning",
                tint = Color.White,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color(0x99000000))
                    .clickable(onClick = onCancel)
                    .padding(11.dp),
            )
        }

        if (granted) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                    .background(Color(0xE60B0C0F))
                    .padding(horizontal = 24.dp, vertical = 24.dp),
            ) {
                Text(
                    text = "Point at the QR code on your laptop",
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.White,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Pinned → Sync Phone · the code expires in about a minute",
                    style = MaterialTheme.typography.bodySmall,
                    color = c.textSecondary,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun CameraViewfinder(onQrDecoded: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentOnQr by rememberUpdatedState(onQrDecoded)

    val scanner = remember {
        BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build(),
        )
    }
    val executor = remember { Executors.newSingleThreadExecutor() }

    DisposableEffect(Unit) {
        onDispose {
            executor.shutdown()
            scanner.close()
        }
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            val previewView = PreviewView(ctx).apply {
                scaleType = PreviewView.ScaleType.FILL_CENTER
            }
            val providerFuture = ProcessCameraProvider.getInstance(ctx)
            providerFuture.addListener(
                {
                    val provider = providerFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val analysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { it.setAnalyzer(executor, QrAnalyzer(scanner) { currentOnQr(it) }) }

                    runCatching {
                        provider.unbindAll()
                        provider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview,
                            analysis,
                        )
                    }
                },
                ContextCompat.getMainExecutor(ctx),
            )
            previewView
        },
    )
}

/**
 * Emits the first QR payload it sees, then stops. One scan is one deliberate sync —
 * re-firing on every frame would push the same batch repeatedly.
 */
private class QrAnalyzer(
    private val scanner: BarcodeScanner,
    private val onQr: (String) -> Unit,
) : ImageAnalysis.Analyzer {

    @Volatile private var handled = false

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(proxy: ImageProxy) {
        val media = proxy.image
        if (handled || media == null) {
            proxy.close()
            return
        }
        val input = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)
        scanner.process(input)
            .addOnSuccessListener { codes ->
                val value = codes.firstNotNullOfOrNull { it.rawValue }
                if (value != null && !handled) {
                    handled = true
                    onQr(value)
                }
            }
            .addOnCompleteListener { proxy.close() }
    }
}

/** Corner brackets plus a slow sweep line — purely a "we're looking" affordance. */
@Composable
private fun Reticle() {
    val accent = PinnedTheme.colors.accent
    val transition = rememberInfiniteTransition(label = "scan")
    val sweep by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2200),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "sweep",
    )

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.fillMaxSize(),
    ) {
        Box(modifier = Modifier.size(240.dp)) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val arm = size.minDimension * 0.2f
                val stroke = 4.5f
                val corners = listOf(
                    Offset(0f, 0f) to listOf(Offset(0f, arm), Offset(arm, 0f)),
                    Offset(size.width, 0f) to listOf(
                        Offset(size.width, arm),
                        Offset(size.width - arm, 0f),
                    ),
                    Offset(0f, size.height) to listOf(
                        Offset(0f, size.height - arm),
                        Offset(arm, size.height),
                    ),
                    Offset(size.width, size.height) to listOf(
                        Offset(size.width, size.height - arm),
                        Offset(size.width - arm, size.height),
                    ),
                )
                corners.forEach { (origin, ends) ->
                    ends.forEach { end ->
                        drawLine(color = Color.White, start = origin, end = end, strokeWidth = stroke)
                    }
                }
                val y = size.height * sweep
                drawLine(
                    color = accent.copy(alpha = 0.85f),
                    start = Offset(12f, y),
                    end = Offset(size.width - 12f, y),
                    strokeWidth = 2.5f,
                )
                // Soft glow under the sweep.
                drawRect(
                    color = accent.copy(alpha = 0.08f),
                    topLeft = Offset(12f, (y - 18f).coerceAtLeast(0f)),
                    size = Size(size.width - 24f, 36f),
                )
            }
        }
    }
}

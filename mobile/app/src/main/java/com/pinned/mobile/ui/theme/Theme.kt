package com.pinned.mobile.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Mobile-elevated dark palette. Shares the Pinned accent family with the desktop
 * app but steps surfaces far enough apart that cards, borders, and muted type
 * stay readable on a phone OLED — desktop near-black tokens do not.
 */
@Immutable
data class PinnedColors(
    val bgApp: Color,
    val bgCard: Color,
    val bgFloat: Color,
    val bgInput: Color,
    val bgHover: Color,
    val bgBadge: Color,
    val border: Color,
    val borderLight: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textDanger: Color,
    val btnPrimaryBg: Color,
    val btnPrimaryText: Color,
    val accent: Color,
    val accentSoft: Color,
    val accentRing: Color,
    val success: Color,
    val successSoft: Color,
    val cardBg: Color,
    val cardBorder: Color,
    val tagBg: Color,
    val tagBorder: Color,
    val cardTextPrimary: Color,
    val cardTextSecondary: Color,
    val cardTextMuted: Color,
)

val PinnedDarkColors = PinnedColors(
    bgApp = Color(0xFF0B0C0F),
    bgCard = Color(0xFF16181D),
    bgFloat = Color(0xFF1A1D24),
    bgInput = Color(0xFF12141A),
    bgHover = Color(0xFF22262F),
    bgBadge = Color(0xFF1E222A),
    border = Color(0xFF2A2E38),
    borderLight = Color(0xFF3A3F4C),
    textPrimary = Color(0xFFF2F3F5),
    textSecondary = Color(0xFFA8ADB8),
    textMuted = Color(0xFF7A8090),
    textDanger = Color(0xFFFF6B6B),
    btnPrimaryBg = Color(0xFFFFFFFF),
    btnPrimaryText = Color(0xFF0B0C0F),
    accent = Color(0xFF5B8CFF),
    accentSoft = Color(0x335B8CFF),
    accentRing = Color(0x665B8CFF),
    success = Color(0xFF4ADE80),
    successSoft = Color(0x244ADE80),
    cardBg = Color(0xFF16181D),
    cardBorder = Color(0xFF2A2E38),
    tagBg = Color(0xFF1E222A),
    tagBorder = Color(0xFF3A3F4C),
    cardTextPrimary = Color(0xFFF2F3F5),
    cardTextSecondary = Color(0xFFA8ADB8),
    cardTextMuted = Color(0xFF7A8090),
)

val PinnedLightColors = PinnedColors(
    bgApp = Color(0xFFFFFFFF),
    bgCard = Color(0xFFF4F4F5),
    bgFloat = Color(0xFFFFFFFF),
    bgInput = Color(0xFFF4F4F5),
    bgHover = Color(0xFFE4E4E7),
    bgBadge = Color(0xFFF4F4F5),
    border = Color(0xFFD4D4D8),
    borderLight = Color(0xFFA1A1AA),
    textPrimary = Color(0xFF18181B),
    textSecondary = Color(0xFF52525B),
    textMuted = Color(0xFF71717A),
    textDanger = Color(0xFFDC2626),
    btnPrimaryBg = Color(0xFF18181B),
    btnPrimaryText = Color(0xFFFFFFFF),
    accent = Color(0xFF2563EB),
    accentSoft = Color(0x1F2563EB),
    accentRing = Color(0x592563EB),
    success = Color(0xFF16A34A),
    successSoft = Color(0x1F16A34A),
    cardBg = Color(0xFFF4F4F5),
    cardBorder = Color(0xFFE4E4E7),
    tagBg = Color(0xFFF4F4F5),
    tagBorder = Color(0xFFE4E4E7),
    cardTextPrimary = Color(0xFF18181B),
    cardTextSecondary = Color(0xFF52525B),
    cardTextMuted = Color(0xFF71717A),
)

object PinnedShape {
    val card = RoundedCornerShape(14.dp)
    val field = RoundedCornerShape(12.dp)
    val sheet = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
    val pill = RoundedCornerShape(percent = 50)
    val banner = RoundedCornerShape(14.dp)
    val composer = RoundedCornerShape(16.dp)
}

private val Sans = FontFamily.SansSerif
private val Mono = FontFamily.Monospace

val PinnedTypography = Typography(
    titleLarge = TextStyle(
        fontFamily = Sans,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.3).sp,
    ),
    titleMedium = TextStyle(
        fontFamily = Sans,
        fontSize = 17.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.2).sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = Sans,
        fontSize = 15.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.Normal,
    ),
    bodyMedium = TextStyle(
        fontFamily = Sans,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.Normal,
    ),
    bodySmall = TextStyle(
        fontFamily = Sans,
        fontSize = 12.sp,
        lineHeight = 17.sp,
        fontWeight = FontWeight.Normal,
    ),
    // Section headers ("CAPTURED", "SYNCED") — mono, uppercase, tracked out.
    labelSmall = TextStyle(
        fontFamily = Mono,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 1.1.sp,
        fontWeight = FontWeight.Medium,
    ),
    labelMedium = TextStyle(
        fontFamily = Mono,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp,
        fontWeight = FontWeight.Medium,
    ),
)

private val LocalPinnedColors = staticCompositionLocalOf { PinnedDarkColors }

object PinnedTheme {
    val colors: PinnedColors
        @Composable @ReadOnlyComposable get() = LocalPinnedColors.current
}

/**
 * The Pinned theme. Dark is the default; light can be toggled in Settings.
 */
@Composable
fun PinnedTheme(
    colors: PinnedColors = PinnedDarkColors,
    content: @Composable () -> Unit,
) {
    androidx.compose.runtime.CompositionLocalProvider(LocalPinnedColors provides colors) {
        MaterialTheme(
            colorScheme = darkColorScheme(
                primary = colors.accent,
                onPrimary = colors.btnPrimaryText,
                background = colors.bgApp,
                onBackground = colors.textPrimary,
                surface = colors.bgCard,
                onSurface = colors.textPrimary,
                surfaceVariant = colors.bgBadge,
                onSurfaceVariant = colors.textSecondary,
                outline = colors.border,
                error = colors.textDanger,
            ),
            typography = PinnedTypography,
            content = content,
        )
    }
}

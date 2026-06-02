# Contributing to PinedIn

Thank you for your interest in contributing to PinedIn! This document provides guidelines and instructions for contributing to the project.

## 🚀 Development Setup

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/pinedin.git
   cd pinedin
   ```

2. **Install Dependencies**
   ```bash
   npm install
   npm install -g @tauri-apps/cli
   ```

3. **Set up Rust** (if not already installed)
   ```bash
   # Follow instructions at https://www.rust-lang.org/tools/install
   ```

4. **Run Development Server**
   ```bash
   npm run tauri dev
   ```

## 🔧 Project Structure

### Frontend (React + TypeScript)
- `src/` - React components, hooks, and utilities
- `src/components/` - Reusable UI components
- `src/store/` - Zustand state management
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and Tauri bindings

### Backend (Rust + Tauri)
- `src-tauri/` - Rust backend code
- `src-tauri/src/commands.rs` - Tauri command handlers
- `src-tauri/src/db.rs` - Database operations
- `src-tauri/src/tray.rs` - System tray implementation

## 📝 Coding Standards

### TypeScript/React
- Use TypeScript strict mode
- Follow React Hooks best practices
- Use functional components with hooks
- Prefer `const` over `let` when possible
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

### Rust
- Follow Rust naming conventions (snake_case for functions/variables)
- Use `Result` for error handling
- Document public functions with doc comments
- Use `clippy` for linting

### Git Commits
- Use [Conventional Commits](https://www.conventionalcommits.org/)
- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Examples:
  - `feat(task): add due date picker`
  - `fix(ui): correct modal z-index issue`
  - `docs: update README with installation steps`

## 🧪 Testing

### Frontend Testing
- Unit tests with Jest + React Testing Library
- Component tests for complex UI logic
- Mock Tauri APIs for isolated testing

### Backend Testing
- Integration tests for database operations
- Unit tests for command handlers
- Use `cargo test` for Rust tests

## 📋 Pull Request Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clear, focused commits
   - Add tests for new functionality
   - Update documentation as needed

3. **Run Tests**
   ```bash
   npm test
   cargo test
   ```

4. **Check Code Quality**
   ```bash
   npm run lint
   npm run type-check
   ```

5. **Submit Pull Request**
   - Fill out the PR template
   - Link related issues
   - Describe changes and testing performed
   - Request reviews from maintainers

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment**
   - OS and version
   - Node.js version
   - Rust version
   - Tauri version

2. **Steps to Reproduce**
   - Clear, numbered steps
   - Expected vs actual behavior

3. **Additional Context**
   - Screenshots if applicable
   - Error logs
   - Any workarounds attempted

## ✨ Feature Requests

We welcome feature requests! Please:

1. Check if the feature already exists
2. Search existing issues for similar requests
3. Describe the problem you're trying to solve
4. Explain why this feature would help
5. Provide mockups or examples if possible

## 🏷️ Release Process

1. **Version Bumping**
   - Update `package.json` version
   - Update `src-tauri/Cargo.toml` version
   - Update `src-tauri/tauri.conf.json` version

2. **Changelog**
   - Update CHANGELOG.md with new features/fixes
   - Group changes by type (Added, Changed, Fixed, etc.)

3. **Release**
   - Create Git tag
   - Build release binaries
   - Publish to GitHub Releases

## 📄 License

By contributing to PinedIn, you agree that your contributions will be licensed under the project's MIT License.

## ❓ Need Help?

- Check the [README.md](README.md) for documentation
- Open a [GitHub Issue](https://github.com/Zarl-prog/PinedIn/issues) for questions
- Join our community discussions

Thank you for contributing to PinedIn! 🎯
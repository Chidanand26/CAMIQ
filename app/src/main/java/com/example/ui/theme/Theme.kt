package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CamiqDarkColorScheme = darkColorScheme(
    primary = CamiqCyanPrimary,
    onPrimary = Color(0xFF021820),
    primaryContainer = CamiqCyanDim,
    onPrimaryContainer = CamiqCyanBright,
    secondary = CamiqEmeraldSafe,
    onSecondary = Color(0xFF022014),
    secondaryContainer = CamiqEmeraldContainer,
    onSecondaryContainer = Color(0xFF6EE7B7),
    tertiary = CamiqAmberWarning,
    onTertiary = Color(0xFF281102),
    tertiaryContainer = CamiqAmberContainer,
    onTertiaryContainer = Color(0xFFFDE68A),
    error = CamiqCoralEmergency,
    onError = Color.White,
    errorContainer = CamiqCoralContainer,
    onErrorContainer = Color(0xFFFECDD3),
    background = CamiqNavyBg,
    onBackground = CamiqTextPrimary,
    surface = CamiqCharcoalSurface,
    onSurface = CamiqTextPrimary,
    surfaceVariant = CamiqCardSurface,
    onSurfaceVariant = CamiqTextSecondary,
    outline = CamiqBorder,
    outlineVariant = Color(0xFF1E293B)
)

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = CamiqDarkColorScheme,
        typography = Typography,
        content = content
    )
}

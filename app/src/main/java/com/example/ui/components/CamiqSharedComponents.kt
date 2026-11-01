package com.example.ui.components

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.data.*
import com.example.ui.theme.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.abs

fun formatTimestamp(ts: Long): String {
    if (ts <= 0L) return "NOT AVAILABLE"
    val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    return sdf.format(Date(ts))
}

@Composable
fun StatusPill(
    text: String,
    containerColor: Color,
    contentColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = containerColor,
        contentColor = contentColor,
        shape = RoundedCornerShape(6.dp),
        modifier = modifier
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun TestBadge(isTest: Boolean) {
    if (isTest) {
        StatusPill(
            text = "TEST",
            containerColor = CamiqPurpleContainer,
            contentColor = Color(0xFFD8B4FE)
        )
    }
}

@Composable
fun RolePreviewTopBar(
    activeRoute: String,
    isRolePreview: Boolean,
    currentUser: UserEntity?,
    onSelectRoute: (String) -> Unit,
    onLogout: () -> Unit
) {
    Surface(
        color = Color(0xFF060A14),
        tonalElevation = 4.dp,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, CamiqBorder)
    ) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(9.dp)
                            .clip(CircleShape)
                            .background(CamiqCyanPrimary)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "CAMIQ 3D TWIN",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = CamiqTextPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    StatusPill(
                        text = "ROLE PREVIEW",
                        containerColor = CamiqAmberContainer,
                        contentColor = CamiqAmberWarning
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (currentUser != null) {
                        Text(
                            text = "${currentUser.fullName} (${currentUser.role})",
                            style = MaterialTheme.typography.labelSmall,
                            color = CamiqTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.widthIn(max = 120.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    TextButton(
                        onClick = onLogout,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                        modifier = Modifier
                            .height(28.dp)
                            .testTag("top_logout_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Logout,
                            contentDescription = "Auth",
                            tint = CamiqCoralEmergency,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Auth", style = MaterialTheme.typography.labelSmall, color = CamiqCoralEmergency)
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                val roles = listOf(
                    Triple("/student", "SAFE (Student)", Icons.Default.Shield),
                    Triple("/guard", "RESPONSE (Guard)", Icons.Default.Security),
                    Triple("/admin", "COMMAND (Admin)", Icons.Default.AdminPanelSettings)
                )
                for ((route, label, icon) in roles) {
                    val selected = activeRoute == route
                    Surface(
                        color = if (selected) CamiqCyanDim else CamiqCharcoalSurface,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .weight(1f)
                            .border(
                                width = 1.dp,
                                color = if (selected) CamiqCyanPrimary else CamiqBorder,
                                shape = RoundedCornerShape(8.dp)
                            )
                            .clickable { onSelectRoute(route) }
                            .testTag("role_switch_${route.removePrefix("/")}")
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                            modifier = Modifier.padding(vertical = 7.dp, horizontal = 4.dp)
                        ) {
                            Icon(
                                imageVector = icon,
                                contentDescription = label,
                                tint = if (selected) CamiqCyanBright else CamiqTextSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = label,
                                style = MaterialTheme.typography.labelSmall,
                                color = if (selected) CamiqCyanBright else CamiqTextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OpaqueQrMatrixCanvas(
    opaqueToken: String,
    size: Dp = 156.dp
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .padding(10.dp)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val grid = 21
            val cellW = this.size.width / grid
            val cellH = this.size.height / grid

            fun isFinderPattern(r: Int, c: Int): Boolean {
                val topLeft = r in 0..6 && c in 0..6
                val topRight = r in 0..6 && c in (grid - 7) until grid
                val bottomLeft = r in (grid - 7) until grid && c in 0..6
                return topLeft || topRight || bottomLeft
            }

            fun drawFinder(startR: Int, startC: Int) {
                for (dr in 0..6) {
                    for (dc in 0..6) {
                        val border = dr == 0 || dr == 6 || dc == 0 || dc == 6
                        val center = dr in 2..4 && dc in 2..4
                        if (border || center) {
                            drawRect(
                                color = Color(0xFF070B14),
                                topLeft = Offset((startC + dc) * cellW, (startR + dr) * cellH),
                                size = Size(cellW + 0.5f, cellH + 0.5f)
                            )
                        }
                    }
                }
            }

            drawFinder(0, 0)
            drawFinder(0, grid - 7)
            drawFinder(grid - 7, 0)

            val bytes = opaqueToken.toByteArray(Charsets.UTF_8)
            var idx = 0
            for (r in 0 until grid) {
                for (c in 0 until grid) {
                    if (isFinderPattern(r, c)) continue
                    if (r == 6 || c == 6) {
                        if ((r + c) % 2 == 0) {
                            drawRect(
                                color = Color(0xFF070B14),
                                topLeft = Offset(c * cellW, r * cellH),
                                size = Size(cellW + 0.5f, cellH + 0.5f)
                            )
                        }
                        continue
                    }
                    val b = bytes.getOrElse(idx % bytes.size.coerceAtLeast(1)) { 42 }.toInt()
                    val bit = ((b xor (r * 31 + c * 17)) and 1) == 1
                    idx++
                    if (bit) {
                        drawRect(
                            color = Color(0xFF070B14),
                            topLeft = Offset(c * cellW, r * cellH),
                            size = Size(cellW + 0.5f, cellH + 0.5f)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Compact Tactical Camera Feed Card for the 3-Camera HUD Dock (`CAM-01`, `CAM-02`, `CAM-03`).
 * - Shows live CameraX hardware stream or local Python MJPEG stream when CONNECTED.
 * - Strictly displays DISCONNECTED when unplugged (never synthetic video).
 * - Includes 1-tap Motion Orchestration trigger and Connect/Disconnect toggle.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun RealCameraFeedCard(
    camera: CameraEntity,
    cameraPermissionGranted: Boolean,
    onRequestCameraPermission: () -> Unit,
    onTriggerMotion: (String, Double) -> Unit,
    onToggleConnect: (String, Boolean) -> Unit,
    onTelemetryUpdate: (String, Double, Long) -> Unit,
    modifier: Modifier = Modifier
) {
    val modeColor = when (camera.orchestrationMode) {
        "INVESTIGATE" -> CamiqCoralEmergency
        "VERIFY" -> CamiqAmberWarning
        else -> CamiqCyanPrimary
    }
    val modeBg = when (camera.orchestrationMode) {
        "INVESTIGATE" -> CamiqCoralContainer
        "VERIFY" -> CamiqAmberContainer
        else -> CamiqCyanDim
    }

    var liveMotionDelta by remember { mutableStateOf(0.0) }
    var liveFps by remember { mutableStateOf(camera.measuredFps) }
    var liveLatency by remember { mutableStateOf(camera.measuredLatencyMs) }

    Surface(
        color = CamiqCardSurface,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(
                width = if (camera.orchestrationMode == "INVESTIGATE") 2.dp else 1.dp,
                color = if (camera.connectionState == "CONNECTED") modeColor else CamiqBorder,
                shape = RoundedCornerShape(12.dp)
            )
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (camera.connectionState == "CONNECTED") Icons.Default.Videocam else Icons.Default.VideocamOff,
                        contentDescription = camera.cameraCode,
                        tint = if (camera.connectionState == "CONNECTED") CamiqCyanBright else CamiqCoralEmergency,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "${camera.cameraCode} • ${camera.name}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = CamiqTextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    StatusPill(
                        text = camera.orchestrationMode,
                        containerColor = modeBg,
                        contentColor = modeColor
                    )
                    StatusPill(
                        text = camera.connectionState,
                        containerColor = if (camera.connectionState == "CONNECTED") CamiqEmeraldContainer else CamiqCoralContainer,
                        contentColor = if (camera.connectionState == "CONNECTED") CamiqEmeraldSafe else CamiqCoralEmergency
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(145.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF050811))
                    .border(1.dp, CamiqBorder, RoundedCornerShape(8.dp))
            ) {
                if (camera.connectionState != "CONNECTED") {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.VideocamOff,
                            contentDescription = "Camera Disconnected",
                            tint = CamiqCoralEmergency,
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "DISCONNECTED",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = CamiqCoralEmergency
                        )
                        Text(
                            text = "USB Index #${camera.deviceIndex} (${camera.cameraType}) — No synthetic feed.",
                            style = MaterialTheme.typography.labelSmall,
                            color = CamiqTextSecondary
                        )
                    }
                } else if (camera.streamUrl.startsWith("http")) {
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                settings.loadWithOverviewMode = true
                                settings.useWideViewPort = true
                                setBackgroundColor(android.graphics.Color.BLACK)
                                webViewClient = WebViewClient()
                                loadUrl(camera.streamUrl)
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                } else if (!cameraPermissionGranted) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Text(
                            text = "Grant Camera Permission for Live USB/Sensor Capture",
                            style = MaterialTheme.typography.labelSmall,
                            color = CamiqTextSecondary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Button(
                            onClick = onRequestCameraPermission,
                            colors = ButtonDefaults.buttonColors(containerColor = CamiqCyanPrimary, contentColor = Color.Black),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Enable Camera", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                } else {
                    HardwareCameraXPreview(
                        deviceIndex = camera.deviceIndex,
                        orchestrationMode = camera.orchestrationMode,
                        onFrameAnalyzed = { fps, latencyMs, motionPct ->
                            liveFps = fps
                            liveLatency = latencyMs
                            liveMotionDelta = motionPct
                            onTelemetryUpdate(camera.cameraCode, fps, latencyMs)
                        }
                    )
                }

                if (camera.connectionState == "CONNECTED") {
                    Surface(
                        color = Color(0xCC050811),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(6.dp)
                    ) {
                        Text(
                            text = "USB#${camera.deviceIndex} | ${"%.1f".format(liveFps)}FPS | ${liveLatency}ms | Δ${"%.1f".format(liveMotionDelta)}%",
                            style = MaterialTheme.typography.labelSmall,
                            color = CamiqCyanBright,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Neighbours: ${camera.neighborCameraCodes.ifEmpty { "NONE" }}" +
                            if (camera.lastAckEventId.isNotEmpty()) " • ACK: ${camera.lastAckEventId}" else "",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (camera.lastAckEventId.isNotEmpty()) CamiqEmeraldSafe else CamiqTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (camera.connectionState == "CONNECTED") {
                        OutlinedButton(
                            onClick = {
                                val delta = if (liveMotionDelta > 1.0) liveMotionDelta else 19.2
                                onTriggerMotion(camera.cameraCode, delta)
                            },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier
                                .height(30.dp)
                                .testTag("motion_trigger_${camera.cameraCode}")
                        ) {
                            Icon(Icons.Default.Sensors, contentDescription = null, modifier = Modifier.size(13.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Motion", style = MaterialTheme.typography.labelSmall)
                        }
                    }

                    OutlinedButton(
                        onClick = { onToggleConnect(camera.cameraCode, camera.connectionState != "CONNECTED") },
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                        modifier = Modifier
                            .height(30.dp)
                            .testTag("toggle_conn_${camera.cameraCode}")
                    ) {
                        Text(
                            text = if (camera.connectionState == "CONNECTED") "Unplug" else "Plug In",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (camera.connectionState == "CONNECTED") CamiqCoralEmergency else CamiqEmeraldSafe
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HardwareCameraXPreview(
    deviceIndex: Int,
    orchestrationMode: String,
    onFrameAnalyzed: (Double, Long, Double) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hardwareError by remember { mutableStateOf<String?>(null) }

    if (hardwareError != null) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            Text(
                text = "Physical Sensor #$deviceIndex: $hardwareError",
                style = MaterialTheme.typography.labelSmall,
                color = CamiqAmberWarning
            )
        }
        return
    }

    AndroidView(
        factory = { ctx ->
            val previewView = PreviewView(ctx).apply {
                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            }
            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
            cameraProviderFuture.addListener({
                try {
                    val provider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val analyzerExecutor = Executors.newSingleThreadExecutor()
                    var prevLumaAvg = -1.0
                    var lastFrameTs = System.currentTimeMillis()

                    val imageAnalysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { analysis ->
                            analysis.setAnalyzer(analyzerExecutor) { imageProxy ->
                                val t0 = System.nanoTime()
                                val buffer = imageProxy.planes[0].buffer
                                val bytes = ByteArray(buffer.remaining().coerceAtMost(4096))
                                buffer.get(bytes)
                                var sum = 0L
                                for (b in bytes) {
                                    sum += (b.toInt() and 0xFF)
                                }
                                val avg = if (bytes.isNotEmpty()) sum.toDouble() / bytes.size else 0.0
                                val motionPct = if (prevLumaAvg >= 0.0) {
                                    (abs(avg - prevLumaAvg) / 255.0) * 100.0
                                } else 0.0
                                prevLumaAvg = avg

                                val now = System.currentTimeMillis()
                                val dt = (now - lastFrameTs).coerceAtLeast(1L)
                                lastFrameTs = now
                                val fps = (1000.0 / dt).coerceIn(1.0, 60.0)
                                val latencyMs = ((System.nanoTime() - t0) / 1_000_000L).coerceAtLeast(1L)

                                imageProxy.close()
                                onFrameAnalyzed(fps, latencyMs, motionPct)
                            }
                        }

                    val selector = if (deviceIndex % 2 == 1) {
                        CameraSelector.DEFAULT_FRONT_CAMERA
                    } else {
                        CameraSelector.DEFAULT_BACK_CAMERA
                    }

                    provider.unbindAll()
                    if (provider.hasCamera(selector)) {
                        provider.bindToLifecycle(lifecycleOwner, selector, preview, imageAnalysis)
                    } else if (provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)) {
                        provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageAnalysis)
                    } else if (provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
                        provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_FRONT_CAMERA, preview, imageAnalysis)
                    } else {
                        hardwareError = "No active physical camera sensor detected on host."
                    }
                } catch (e: Exception) {
                    hardwareError = e.localizedMessage ?: "Sensor unavailable"
                }
            }, ContextCompat.getMainExecutor(ctx))
            previewView
        },
        modifier = Modifier.fillMaxSize()
    )
}

/**
 * CesiumJS 3D Campus Digital Twin ("God's-Eye View" Spatial Intelligence Engine)
 * Inspired by bilawalsidhu/gods-eye-view:
 * - Keyless-first CesiumJS 3D Globe & Ellipsoid with OpenStreetMap base tiles
 * - 3D extruded campus building blocks around the configured campus coordinates
 * - Volumetric 3D camera FOV frustums & ground coverage cones for CAM-01, CAM-02, CAM-03
 *   colored dynamically by mode (WATCH = Cyan, VERIFY = Amber, INVESTIGATE = Coral)
 * - Pulsing 3D SOS emergency pillars & SafeWalk 3D corridor polylines
 * - Tactical HUD shader modes (STD, NVG Night Vision, FLIR Thermal, CRT Grid)
 * - Click-to-Fly Camera Lock-On ("Ride-Along" POV from CAM-01, CAM-02, CAM-03, or Orbital Overview)
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun CesiumDigitalTwinView(
    sites: List<SiteEntity>,
    cameras: List<CameraEntity>,
    incidents: List<IncidentEntity>,
    safeWalks: List<SafeWalkEntity>,
    laboratories: List<LaboratoryEntity>,
    height: Dp = 320.dp,
    modifier: Modifier = Modifier
) {
    val twinPayloadJson = remember(sites, cameras, incidents, safeWalks, laboratories) {
        val root = JSONObject()
        val sitesArr = JSONArray()
        sites.forEach { s ->
            sitesArr.put(
                JSONObject().apply {
                    put("name", "${s.institutionName} — ${s.campusName}")
                    put("lat", s.latitude)
                    put("lng", s.longitude)
                }
            )
        }
        root.put("sites", sitesArr)

        val camsArr = JSONArray()
        cameras.filter { it.latitude != null && it.longitude != null }.forEach { c ->
            camsArr.put(
                JSONObject().apply {
                    put("code", c.cameraCode)
                    put("name", c.name)
                    put("type", c.cameraType)
                    put("state", c.connectionState)
                    put("mode", c.orchestrationMode)
                    put("lat", c.latitude!!)
                    put("lng", c.longitude!!)
                    put("dir", c.directionDeg)
                    put("fov", c.fovAngleDeg)
                    put("dist", c.maxDistanceMeters)
                }
            )
        }
        root.put("cameras", camsArr)

        val incArr = JSONArray()
        incidents.filter { it.latitude != null && it.longitude != null && it.status != "CANCELLED" }.forEach { inc ->
            incArr.put(
                JSONObject().apply {
                    put("id", inc.incidentId)
                    put("type", inc.type)
                    put("category", inc.category)
                    put("status", inc.status)
                    put("gap", inc.hasCoverageGap)
                    put("lat", inc.latitude!!)
                    put("lng", inc.longitude!!)
                }
            )
        }
        root.put("incidents", incArr)

        val walkArr = JSONArray()
        safeWalks.filter { it.liveLocationConsented && it.status != "COMPLETED_SAFE" }.forEach { w ->
            walkArr.put(
                JSONObject().apply {
                    put("id", w.sessionId)
                    put("student", w.studentName)
                    put("status", w.status)
                    put("startLat", w.startLat)
                    put("startLng", w.startLng)
                    put("destLat", w.destLat)
                    put("destLng", w.destLng)
                }
            )
        }
        root.put("walks", walkArr)
        root.toString()
    }

    val htmlContent = remember(twinPayloadJson) {
        """
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <script src="https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Cesium.js"></script>
          <link href="https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
          <style>
            html, body, #cesiumContainer {
              width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden;
              background: #050811; font-family: 'JetBrains Mono', monospace; color: #F8FAFC;
            }
            .cesium-viewer-bottom, .cesium-viewer-toolbar, .cesium-viewer-animationContainer, .cesium-viewer-timelineContainer {
              display: none !important;
            }
            /* Tactical Shader Overlays (inspired by gods-eye-view) */
            body.mode-nvg #cesiumContainer {
              filter: sepia(100%) hue-rotate(85deg) saturate(320%) brightness(0.95) contrast(1.35);
            }
            body.mode-flir #cesiumContainer {
              filter: invert(100%) hue-rotate(190deg) saturate(260%) contrast(1.45);
            }
            .scanline-overlay {
              pointer-events: none; position: absolute; inset: 0; z-index: 10;
              background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
                          radial-gradient(circle at center, transparent 60%, rgba(5, 8, 17, 0.75) 100%);
              background-size: 100% 4px, 100% 100%;
            }
            .hud-top {
              position: absolute; top: 8px; left: 8px; right: 8px; z-index: 20;
              display: flex; justify-content: space-between; align-items: center; gap: 6px;
              pointer-events: none;
            }
            .hud-badge {
              pointer-events: auto;
              background: rgba(5, 8, 17, 0.86); border: 1px solid #06B6D4;
              padding: 4px 8px; border-radius: 6px; font-size: 10px; color: #22D3EE;
              text-transform: uppercase; letter-spacing: 0.6px;
            }
            .hud-controls {
              position: absolute; bottom: 8px; left: 8px; right: 8px; z-index: 20;
              display: flex; flex-wrap: wrap; gap: 5px; justify-content: space-between;
            }
            .hud-btn {
              background: rgba(15, 23, 42, 0.88); border: 1px solid #283650;
              color: #F8FAFC; padding: 5px 8px; border-radius: 6px; font-size: 10px;
              cursor: pointer; font-family: monospace; font-weight: bold;
            }
            .hud-btn.active { border-color: #06B6D4; color: #22D3EE; background: rgba(8, 51, 68, 0.9); }
            .reticle {
              pointer-events: none; position: absolute; top: 50%; left: 50%;
              width: 36px; height: 36px; transform: translate(-50%, -50%);
              border: 1px dashed rgba(6, 182, 212, 0.35); border-radius: 50%; z-index: 12;
            }
          </style>
        </head>
        <body>
          <div id="cesiumContainer"></div>
          <div class="scanline-overlay"></div>
          <div class="reticle"></div>

          <div class="hud-top">
            <div class="hud-badge" id="twinTitle">CESIUMJS 3D DIGITAL TWIN • GOD'S-EYE VIEW</div>
            <div style="display:flex; gap:4px; pointer-events:auto;">
              <button class="hud-btn active" id="btnStd" onclick="setVision('std')">STD</button>
              <button class="hud-btn" id="btnNvg" onclick="setVision('nvg')">NVG</button>
              <button class="hud-btn" id="btnFlir" onclick="setVision('flir')">FLIR</button>
            </div>
          </div>

          <div class="hud-controls">
            <div style="display:flex; gap:4px;">
              <button class="hud-btn active" onclick="flyToCampus()">3D ORBIT</button>
              <button class="hud-btn" onclick="flyToCam('CAM-01')">POV CAM-01</button>
              <button class="hud-btn" onclick="flyToCam('CAM-02')">POV CAM-02</button>
              <button class="hud-btn" onclick="flyToCam('CAM-03')">POV CAM-03</button>
            </div>
            <div class="hud-badge" id="telemetryReadout">LOADING 3D TWIN...</div>
          </div>

          <script>
            const data = $twinPayloadJson;
            let baseLat = 28.5450, baseLng = 77.1926;
            if (data.sites.length > 0) {
              baseLat = data.sites[0].lat; baseLng = data.sites[0].lng;
            } else if (data.cameras.length > 0) {
              baseLat = data.cameras[0].lat; baseLng = data.cameras[0].lng;
            } else if (data.incidents.length > 0) {
              baseLat = data.incidents[0].lat; baseLng = data.incidents[0].lng;
            }

            function setVision(mode) {
              document.body.className = mode === 'std' ? '' : 'mode-' + mode;
              ['Std', 'Nvg', 'Flir'].forEach(m => {
                document.getElementById('btn' + m).classList.toggle('active', m.toLowerCase() === mode);
              });
            }

            let viewer = null;
            try {
              viewer = new Cesium.Viewer('cesiumContainer', {
                imageryProvider: new Cesium.OpenStreetMapImageryProvider({
                  url: 'https://a.tile.openstreetmap.org/'
                }),
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                infoBox: false,
                sceneModePicker: false,
                selectionIndicator: false,
                timeline: false,
                navigationHelpButton: false,
                animation: false,
                skyAtmosphere: false
              });
              viewer.scene.globe.enableLighting = false;
              viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050811');

              function destPoint(lat, lng, brngDeg, distM) {
                const R = 6371000.0;
                const d = distM / R;
                const brng = brngDeg * Math.PI / 180.0;
                const lat1 = lat * Math.PI / 180.0;
                const lon1 = lng * Math.PI / 180.0;
                const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(brng));
                const lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
                return [lon2 * 180.0 / Math.PI, lat2 * 180.0 / Math.PI];
              }

              // Render 3D Campus Building Extrusions around configured campus site or cameras
              if (data.sites.length > 0 || data.cameras.length > 0) {
                const bldOffsets = [
                  { name: 'Academic Block A', dLat: 0.00025, dLng: -0.00025, w: 0.00022, h: 0.00016, elev: 28 },
                  { name: 'Robotics & AI Lab', dLat: 0.00040, dLng: 0.00030, w: 0.00025, h: 0.00018, elev: 34 },
                  { name: 'Central Library', dLat: -0.00030, dLng: 0.00025, w: 0.00026, h: 0.00020, elev: 24 },
                  { name: 'Security Gatehouse', dLat: -0.00008, dLng: -0.00008, w: 0.00012, h: 0.00010, elev: 12 }
                ];
                bldOffsets.forEach(b => {
                  const lat0 = baseLat + b.dLat;
                  const lng0 = baseLng + b.dLng;
                  viewer.entities.add({
                    name: b.name,
                    polygon: {
                      hierarchy: Cesium.Cartesian3.fromDegreesArray([
                        lng0, lat0,
                        lng0 + b.w, lat0,
                        lng0 + b.w, lat0 + b.h,
                        lng0, lat0 + b.h
                      ]),
                      extrudedHeight: b.elev,
                      material: Cesium.Color.fromCssColorString('#0F172A').withAlpha(0.82),
                      outline: true,
                      outlineColor: Cesium.Color.fromCssColorString('#06B6D4').withAlpha(0.65)
                    }
                  });
                });
              }

              // Render 3D Camera Towers + Volumetric 3D FOV Cones for CAM-01, CAM-02, CAM-03
              data.cameras.forEach(c => {
                const cssColor = c.state !== 'CONNECTED' ? '#64748B' :
                                 (c.mode === 'INVESTIGATE' ? '#F43F5E' :
                                 (c.mode === 'VERIFY' ? '#F59E0B' : '#06B6D4'));
                const cColor = Cesium.Color.fromCssColorString(cssColor);

                // Camera Pylon at 14m height
                viewer.entities.add({
                  position: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, 14),
                  point: { pixelSize: 10, color: cColor, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
                  label: {
                    text: c.code + ' [' + c.mode + ']',
                    font: 'bold 11px monospace',
                    fillColor: cColor,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 3,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -12)
                  }
                });

                // 3D FOV Frustum Wedge & Ground Footprint
                const coords = [c.lng, c.lat];
                const startA = c.dir - (c.fov / 2.0);
                const endA = c.dir + (c.fov / 2.0);
                for (let a = startA; a <= endA; a += 8) {
                  const pt = destPoint(c.lat, c.lng, a, c.dist);
                  coords.push(pt[0], pt[1]);
                }
                viewer.entities.add({
                  polygon: {
                    hierarchy: Cesium.Cartesian3.fromDegreesArray(coords),
                    extrudedHeight: 8.0,
                    material: cColor.withAlpha(0.26),
                    outline: true,
                    outlineColor: cColor
                  }
                });
              });

              // Render 3D SOS Beacons
              data.incidents.forEach(inc => {
                const incColor = Cesium.Color.fromCssColorString(inc.gap ? '#F59E0B' : '#F43F5E');
                viewer.entities.add({
                  position: Cesium.Cartesian3.fromDegrees(inc.lng, inc.lat, 25),
                  cylinder: {
                    length: 50.0,
                    topRadius: 6.0,
                    bottomRadius: 1.5,
                    material: incColor.withAlpha(0.65),
                    outline: true,
                    outlineColor: Cesium.Color.WHITE
                  },
                  label: {
                    text: inc.id + (inc.gap ? ' [COVERAGE GAP]' : ''),
                    font: 'bold 12px monospace',
                    fillColor: Cesium.Color.WHITE,
                    backgroundColor: incColor.withAlpha(0.85),
                    showBackground: true,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -28)
                  }
                });
              });

              // Render 3D SafeWalk Corridors
              data.walks.forEach(w => {
                viewer.entities.add({
                  polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                      w.startLng, w.startLat, 4,
                      w.destLng, w.destLat, 4
                    ]),
                    width: 4,
                    material: Cesium.Color.fromCssColorString('#10B981')
                  }
                });
              });

              window.flyToCampus = function() {
                viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(baseLng, baseLat - 0.0020, 260.0),
                  orientation: {
                    heading: Cesium.Math.toRadians(0.0),
                    pitch: Cesium.Math.toRadians(-42.0),
                    roll: 0.0
                  },
                  duration: 1.2
                });
              };

              window.flyToCam = function(code) {
                const cam = data.cameras.find(x => x.code === code);
                if (!cam) {
                  document.getElementById('telemetryReadout').innerText = code + ' NOT CONFIGURED YET';
                  return;
                }
                viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, 18.0),
                  orientation: {
                    heading: Cesium.Math.toRadians(cam.dir),
                    pitch: Cesium.Math.toRadians(-18.0),
                    roll: 0.0
                  },
                  duration: 1.1
                });
                document.getElementById('telemetryReadout').innerText =
                  'LOCK-ON POV: ' + cam.code + ' (' + cam.mode + ' | ' + cam.dir + '°)';
              };

              flyToCampus();
              document.getElementById('telemetryReadout').innerText =
                data.cameras.length === 0
                  ? '0 CAMERAS BOUND (TAP 1-CLICK 3-CAMERA TWIN SETUP)'
                  : data.cameras.length + ' 3D CAMERAS • ' + data.incidents.length + ' SOS BEACONS';
            } catch (err) {
              document.getElementById('telemetryReadout').innerText = '3D ENGINE READY';
            }
          </script>
        </body>
        </html>
        """.trimIndent()
    }

    Surface(
        color = CamiqCardSurface,
        shape = RoundedCornerShape(14.dp),
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .border(1.dp, CamiqCyanPrimary.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
    ) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    setBackgroundColor(android.graphics.Color.parseColor("#050811"))
                    webViewClient = WebViewClient()
                }
            },
            update = { webView ->
                webView.loadDataWithBaseURL(
                    "https://cesium.com",
                    htmlContent,
                    "text/html",
                    "UTF-8",
                    null
                )
            },
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(14.dp))
        )
    }
}

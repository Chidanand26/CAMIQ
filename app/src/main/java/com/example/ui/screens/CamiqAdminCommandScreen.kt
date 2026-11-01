package com.example.ui.screens

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.*
import com.example.ui.CamiqViewModel
import com.example.ui.DiscoveredHardwareCamera
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun CamiqAdminCommandScreen(
    viewModel: CamiqViewModel,
    users: List<UserEntity>,
    sites: List<SiteEntity>,
    cameras: List<CameraEntity>,
    orchestrationEvents: List<OrchestrationEventEntity>,
    incidents: List<IncidentEntity>,
    safeWalks: List<SafeWalkEntity>,
    gateEvents: List<GateEventEntity>,
    visitorPasses: List<VisitorPassEntity>,
    departments: List<DepartmentEntity>,
    laboratories: List<LaboratoryEntity>,
    assets: List<AssetEntity>,
    auditLogs: List<AuditLogEntity>,
    systemConfig: SystemConfigEntity,
    discoveredHardware: List<DiscoveredHardwareCamera>,
    pythonManagerReachable: Boolean,
    cameraPermissionGranted: Boolean,
    onRequestCameraPermission: () -> Unit
) {
    // Minimal Single-Screen Administrator "God's-Eye View" Command Layout (Zero Sub-Tabs)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Tactical Telemetry Bar + 1-Click 3-Camera 3D Digital Twin Binding
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqCyanPrimary.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "CAMIQ COMMAND — 3D DIGITAL TWIN & 3-CAMERA HUD",
                            style = MaterialTheme.typography.labelLarge,
                            color = CamiqCyanBright
                        )
                        Text(
                            text = "Cameras Online: ${cameras.count { it.connectionState == "CONNECTED" }}/${cameras.size} • Incidents: ${incidents.size} • Gate Scans: ${gateEvents.size}",
                            style = MaterialTheme.typography.bodySmall,
                            color = CamiqTextSecondary
                        )
                    }
                    Button(
                        onClick = { viewModel.setupThreeCameraCampusTwin() },
                        colors = ButtonDefaults.buttonColors(containerColor = CamiqCyanPrimary, contentColor = Color(0xFF021820)),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier
                            .height(36.dp)
                            .testTag("bind_3_cameras_button")
                    ) {
                        Icon(Icons.Default.Videocam, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Auto-Bind 3 USB Cameras", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // 2. Hero CesiumJS 3D Campus Digital Twin (God's-Eye View with 3D Buildings, Volumetric FOV Cones, NVG/FLIR Shaders)
        CesiumDigitalTwinView(
            sites = sites,
            cameras = cameras,
            incidents = incidents,
            safeWalks = safeWalks,
            laboratories = laboratories,
            height = 350.dp
        )

        // 3. Persistent 3-Camera Live Wall (CAM-01, CAM-02, CAM-03) + Collaborative Motion Orchestration
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(14.dp))
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "3 USB WEBCAMS — LIVE DOCK (CAM-01, CAM-02, CAM-03)",
                            style = MaterialTheme.typography.labelLarge,
                            color = CamiqCyanBright
                        )
                        Text(
                            text = "WATCH → VERIFY → INVESTIGATE collaborative orchestration across neighbours.",
                            style = MaterialTheme.typography.bodySmall,
                            color = CamiqTextSecondary
                        )
                    }
                    if (cameras.isNotEmpty()) {
                        OutlinedButton(
                            onClick = { viewModel.resetCameraModesToWatch() },
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text("Reset WATCH", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                if (cameras.isEmpty()) {
                    Text(
                        text = "0 cameras registered. Tap 'Auto-Bind 3 USB Cameras' at the top to bind CAM-01 (USB #0, Entrance QR), CAM-02 (USB #1, Lab), and CAM-03 (USB #2, Corridor) onto the 3D Digital Twin.",
                        style = MaterialTheme.typography.bodySmall,
                        color = CamiqAmberWarning
                    )
                } else {
                    cameras.forEach { cam ->
                        RealCameraFeedCard(
                            camera = cam,
                            cameraPermissionGranted = cameraPermissionGranted,
                            onRequestCameraPermission = onRequestCameraPermission,
                            onTriggerMotion = { code, delta ->
                                viewModel.triggerCameraMotionEvent(code, delta, cam.isTestRecord)
                            },
                            onToggleConnect = { code, connect ->
                                viewModel.setCameraConnectionState(code, connect)
                            },
                            onTelemetryUpdate = { code, fps, lat ->
                                viewModel.updateCameraLiveTelemetry(code, fps, lat)
                            }
                        )
                    }
                }
            }
        }

        // 4. Live Coverage-to-Compute & Collaborative Orchestration Telemetry
        Surface(
            color = CamiqCharcoalSurface,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(14.dp))
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "COVERAGE-TO-COMPUTE & MOTION ORCHESTRATION LOG (${orchestrationEvents.size})",
                    style = MaterialTheme.typography.labelLarge,
                    color = CamiqCyanBright
                )
                if (orchestrationEvents.isEmpty()) {
                    Text(
                        text = "Trigger 'Motion' on CAM-01 above or trigger an SOS from SAFE (/student) to watch CAM-02 and CAM-03 switch to INVESTIGATE mode.",
                        style = MaterialTheme.typography.bodySmall,
                        color = CamiqTextSecondary
                    )
                } else {
                    orchestrationEvents.take(5).forEach { evt ->
                        Surface(
                            color = CamiqCardSurface,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = "${evt.eventId} • ${evt.triggerType}",
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                    StatusPill(
                                        text = if (evt.hasCoverageGap) "CAMERA COVERAGE GAP" else "ACK: ${evt.acknowledgedByCameras}",
                                        containerColor = if (evt.hasCoverageGap) CamiqAmberContainer else CamiqEmeraldContainer,
                                        contentColor = if (evt.hasCoverageGap) CamiqAmberWarning else CamiqEmeraldSafe
                                    )
                                }
                                Text(
                                    text = evt.selectionReasoning,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = CamiqTextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

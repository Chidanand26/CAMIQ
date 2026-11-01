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
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun CamiqGuardResponseScreen(
    viewModel: CamiqViewModel,
    currentUser: UserEntity?,
    users: List<UserEntity>,
    sites: List<SiteEntity>,
    cameras: List<CameraEntity>,
    orchestrationEvents: List<OrchestrationEventEntity>,
    incidents: List<IncidentEntity>,
    safeWalks: List<SafeWalkEntity>,
    gateEvents: List<GateEventEntity>,
    visitorPasses: List<VisitorPassEntity>,
    laboratories: List<LaboratoryEntity>,
    assets: List<AssetEntity>,
    systemConfig: SystemConfigEntity,
    lastGateScanEvent: GateEventEntity?,
    activeStudentQrToken: QrTokenEntity?,
    cameraPermissionGranted: Boolean,
    onRequestCameraPermission: () -> Unit
) {
    val activeGuard = if (currentUser?.role == "GUARD") currentUser else users.firstOrNull { it.role == "GUARD" }
    var qrInput by remember(activeStudentQrToken) {
        mutableStateOf(activeStudentQrToken?.opaqueToken ?: "")
    }

    // Minimal Single-Screen Guard Tactical Layout (Zero Sub-Tabs)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Guard Duty & Tactical Status Bar
        Surface(
            color = CamiqCharcoalSurface,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(12.dp))
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.padding(12.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "CAMIQ RESPONSE — GUARD TACTICAL CONSOLE",
                        style = MaterialTheme.typography.labelLarge,
                        color = CamiqEmeraldSafe
                    )
                    Text(
                        text = activeGuard?.let { "${it.fullName} (${it.gender}) • ${if (it.isOnDuty) "ON DUTY" else "OFF DUTY"}" }
                            ?: "On-Duty Security Operator Console",
                        style = MaterialTheme.typography.bodySmall,
                        color = CamiqTextSecondary
                    )
                }
                if (activeGuard != null) {
                    Button(
                        onClick = { viewModel.toggleGuardDuty(activeGuard.id, !activeGuard.isOnDuty) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (activeGuard.isOnDuty) CamiqEmeraldContainer else CamiqCoralContainer,
                            contentColor = if (activeGuard.isOnDuty) CamiqEmeraldSafe else CamiqCoralEmergency
                        ),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Text(if (activeGuard.isOnDuty) "ON DUTY" else "OFF DUTY", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }

        // 2. CesiumJS 3D Campus Digital Twin (God's-Eye View with 3D Camera FOV Cones & SOS Beacons)
        CesiumDigitalTwinView(
            sites = sites,
            cameras = cameras,
            incidents = incidents,
            safeWalks = safeWalks,
            laboratories = laboratories,
            height = 290.dp
        )

        // 3. Persistent 3-Camera Wall (CAM-01, CAM-02, CAM-03)
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(14.dp))
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "3-CAMERA LIVE WALL (${cameras.count { it.connectionState == "CONNECTED" }}/${cameras.size} ONLINE)",
                        style = MaterialTheme.typography.labelLarge,
                        color = CamiqCyanBright
                    )
                    if (cameras.isEmpty()) {
                        Button(
                            onClick = { viewModel.setupThreeCameraCampusTwin() },
                            colors = ButtonDefaults.buttonColors(containerColor = CamiqCyanPrimary, contentColor = Color.Black),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("Bind 3 USB Cameras", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        TextButton(
                            onClick = { viewModel.resetCameraModesToWatch() },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Reset WATCH", style = MaterialTheme.typography.labelSmall, color = CamiqCyanBright)
                        }
                    }
                }

                if (cameras.isEmpty()) {
                    Text(
                        text = "Tap 'Bind 3 USB Cameras' above to register CAM-01 (Entrance QR), CAM-02 (Lab), and CAM-03 (Corridor) onto the 3D Digital Twin.",
                        style = MaterialTheme.typography.bodySmall,
                        color = CamiqTextSecondary
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

        // 4. Unified SOS Incident & SafeWalk Response Queue
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(14.dp))
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "ACTIVE SOS & SAFEWALK DISPATCH (${incidents.size} INCIDENTS • ${safeWalks.size} ESCORTS)",
                    style = MaterialTheme.typography.labelLarge,
                    color = CamiqCyanBright
                )

                if (incidents.isEmpty() && safeWalks.isEmpty()) {
                    Text(
                        text = "0 active alerts. Trigger SOS or SafeWalk from SAFE (/student) to see Coverage-to-Compute 3D camera selection.",
                        style = MaterialTheme.typography.bodySmall,
                        color = CamiqTextSecondary
                    )
                }

                incidents.take(4).forEach { inc ->
                    Surface(
                        color = CamiqCharcoalSurface,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "${inc.incidentId} • ${inc.category}",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold
                                )
                                StatusPill(
                                    text = inc.status,
                                    containerColor = if (inc.status == "OPEN") CamiqCoralContainer else CamiqEmeraldContainer,
                                    contentColor = if (inc.status == "OPEN") CamiqCoralEmergency else CamiqEmeraldSafe
                                )
                            }
                            Text(
                                text = inc.coverageReasoning.lines().firstOrNull() ?: "Assigned Cameras: ${inc.selectedCameras}",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (inc.hasCoverageGap) CamiqAmberWarning else CamiqCyanBright
                            )
                            if (inc.status != "RESOLVED" && inc.status != "CANCELLED") {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(
                                        onClick = { viewModel.guardUpdateIncident(inc.incidentId, "ACKNOWLEDGED", "Guard acknowledged on 3D Twin") },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Acknowledge", style = MaterialTheme.typography.labelSmall)
                                    }
                                    Button(
                                        onClick = { viewModel.guardUpdateIncident(inc.incidentId, "RESOLVED", "Resolved by Guard") },
                                        colors = ButtonDefaults.buttonColors(containerColor = CamiqEmeraldSafe, contentColor = Color.Black),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Resolve", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }

                safeWalks.filter { it.status != "COMPLETED_SAFE" }.forEach { w ->
                    Surface(
                        color = CamiqCharcoalSurface,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.padding(10.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${w.sessionId}: ${w.startLabel} → ${w.destLabel}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                Text("Female Preferred: ${w.preferFemaleResponder} • Status: ${w.status}", style = MaterialTheme.typography.labelSmall, color = CamiqTextSecondary)
                            }
                            Button(
                                onClick = { viewModel.guardAcceptSafeWalk(w.sessionId) },
                                colors = ButtonDefaults.buttonColors(containerColor = CamiqEmeraldSafe, contentColor = Color.Black),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("Accept Escort", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // 5. CAM-01 Smart Entry QR Gate Validator (IN / OUT + Anti-Passback)
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(14.dp))
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "CAM-01 SMART ENTRY QR GATE (${systemConfig.activeGateDirection})",
                        style = MaterialTheme.typography.labelLarge,
                        color = CamiqCyanBright
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(
                            selected = systemConfig.activeGateDirection == "IN",
                            onClick = { viewModel.updateGateConfig(systemConfig.activeGateName, "IN", "CAM-01") },
                            label = { Text("IN", style = MaterialTheme.typography.labelSmall) }
                        )
                        FilterChip(
                            selected = systemConfig.activeGateDirection == "OUT",
                            onClick = { viewModel.updateGateConfig(systemConfig.activeGateName, "OUT", "CAM-01") },
                            label = { Text("OUT", style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = qrInput,
                        onValueChange = { qrInput = it },
                        label = { Text("Opaque QR Token") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = { viewModel.scanQrAtEntranceCamera(qrInput, "CAM-01", false) },
                        colors = ButtonDefaults.buttonColors(containerColor = CamiqCyanPrimary, contentColor = Color.Black),
                        modifier = Modifier.height(48.dp)
                    ) {
                        Text("Validate QR", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    }
                }

                lastGateScanEvent?.let { ev ->
                    StatusPill(
                        text = "${ev.scanResult} (${ev.direction} • ${ev.personName})",
                        containerColor = if (ev.scanResult == "ACCESS RECORDED") CamiqEmeraldContainer else CamiqCoralContainer,
                        contentColor = if (ev.scanResult == "ACCESS RECORDED") CamiqEmeraldSafe else CamiqCoralEmergency
                    )
                }
            }
        }
    }
}

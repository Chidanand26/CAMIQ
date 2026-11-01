package com.example.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.data.*
import com.example.ui.CamiqViewModel
import com.example.ui.components.*
import com.example.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun CamiqStudentSafeScreen(
    viewModel: CamiqViewModel,
    currentUser: UserEntity?,
    sites: List<SiteEntity>,
    cameras: List<CameraEntity>,
    incidents: List<IncidentEntity>,
    safeWalks: List<SafeWalkEntity>,
    trustedContacts: List<TrustedContactEntity>,
    gateEvents: List<GateEventEntity>,
    activeQrToken: QrTokenEntity?,
    qrSecondsRemaining: Int,
    checkInTimerSeconds: Int?
) {
    val context = LocalContext.current
    val defaultLat = sites.firstOrNull()?.latitude ?: cameras.firstOrNull { it.latitude != null }?.latitude ?: 28.5450
    val defaultLng = sites.firstOrNull()?.longitude ?: cameras.firstOrNull { it.longitude != null }?.longitude ?: 77.1926

    var locationConsent by remember { mutableStateOf(true) }
    var preferFemaleResponder by remember { mutableStateOf(true) }
    var isHoldingSos by remember { mutableStateOf(false) }
    var holdProgress by remember { mutableStateOf(0f) }

    LaunchedEffect(isHoldingSos) {
        if (isHoldingSos) {
            holdProgress = 0f
            val steps = 20
            for (i in 1..steps) {
                delay(70L)
                holdProgress = i / steps.toFloat()
            }
            if (isHoldingSos) {
                viewModel.triggerStudentSos(
                    isDiscreet = false,
                    locationConsented = locationConsent,
                    latitude = defaultLat,
                    longitude = defaultLng,
                    isTestSos = false
                )
                isHoldingSos = false
                holdProgress = 0f
            }
        } else {
            holdProgress = 0f
        }
    }

    // Minimal Single-Screen Layout (Zero Sub-Tabs)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. SOS Emergency Assistance Card (Press & Hold + TEST SOS + Manual 112)
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqCoralEmergency.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        Text(
                            text = "CAMIQ SAFE — STUDENT PROTECTION",
                            style = MaterialTheme.typography.labelLarge,
                            color = CamiqCyanBright
                        )
                        Text(
                            text = currentUser?.fullName ?: "Active Student Session",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = CamiqTextPrimary
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Location Consent", style = MaterialTheme.typography.labelSmall, color = CamiqTextSecondary)
                        Spacer(modifier = Modifier.width(6.dp))
                        Switch(checked = locationConsent, onCheckedChange = { locationConsent = it })
                    }
                }

                // Press-and-Hold SOS Orb
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(160.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(CamiqCoralEmergency, Color(0xFF9F1239), Color(0xFF4C0519))
                            )
                        )
                        .border(
                            width = if (isHoldingSos) 4.dp else 2.dp,
                            color = if (isHoldingSos) Color.White else CamiqCoralEmergency,
                            shape = CircleShape
                        )
                        .pointerInput(locationConsent, defaultLat, defaultLng) {
                            detectTapGestures(
                                onPress = {
                                    isHoldingSos = true
                                    tryAwaitRelease()
                                    isHoldingSos = false
                                }
                            )
                        }
                        .testTag("sos_hold_button")
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.EmergencyShare,
                            contentDescription = "SOS",
                            tint = Color.White,
                            modifier = Modifier.size(38.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isHoldingSos) "${(holdProgress * 100).toInt()}%" else "SOS",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "HOLD 1.5s",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFFECDD3)
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = {
                            viewModel.triggerStudentSos(
                                isDiscreet = false,
                                locationConsented = locationConsent,
                                latitude = defaultLat,
                                longitude = defaultLng,
                                isTestSos = true,
                                customNote = "TEST 9 SOS from CAMIQ SAFE"
                            )
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CamiqPurpleContainer,
                            contentColor = Color(0xFFD8B4FE)
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("test_sos_button")
                    ) {
                        Icon(Icons.Default.Science, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Trigger TEST SOS", style = MaterialTheme.typography.labelSmall)
                    }

                    OutlinedButton(
                        onClick = {
                            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:112"))
                            context.startActivity(intent)
                        },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = CamiqAmberWarning),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("call_112_button")
                    ) {
                        Icon(Icons.Default.PhoneInTalk, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("CALL 112 (INDIA)", style = MaterialTheme.typography.labelSmall)
                    }
                }

                // Active Incident Status Strip (if any)
                incidents.firstOrNull { it.status != "CANCELLED" }?.let { latestInc ->
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
                                Text(
                                    text = "${latestInc.incidentId} • ${latestInc.status}",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = if (latestInc.hasCoverageGap) "CAMERA COVERAGE GAP" else "3D Twin Cameras: ${latestInc.selectedCameras}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (latestInc.hasCoverageGap) CamiqAmberWarning else CamiqCyanBright
                                )
                            }
                            if (latestInc.status == "OPEN") {
                                TextButton(onClick = { viewModel.cancelStudentSos(latestInc.incidentId, "Accidental trigger") }) {
                                    Text("Cancel", style = MaterialTheme.typography.labelSmall, color = CamiqCoralEmergency)
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Rotating 30s Smart Entry QR Pass Card
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqCyanPrimary.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "ROTATING 30s GATE QR PASS (ZERO PII)",
                        style = MaterialTheme.typography.labelLarge,
                        color = CamiqCyanBright
                    )
                    StatusPill(
                        text = "GATE: ${currentUser?.campusPresenceState ?: "OUTSIDE"}",
                        containerColor = if (currentUser?.campusPresenceState == "INSIDE") CamiqEmeraldContainer else CamiqElevatedSurface,
                        contentColor = if (currentUser?.campusPresenceState == "INSIDE") CamiqEmeraldSafe else CamiqTextSecondary
                    )
                }

                if (activeQrToken != null) {
                    OpaqueQrMatrixCanvas(opaqueToken = activeQrToken.opaqueToken, size = 148.dp)
                    Text(
                        text = "${activeQrToken.opaqueToken} (${if (activeQrToken.isConsumed) "CONSUMED" else "${qrSecondsRemaining}s"})",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (activeQrToken.isConsumed) CamiqCoralEmergency else CamiqCyanBright
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(
                            onClick = { viewModel.refreshStudentRotatingQr() },
                            modifier = Modifier
                                .weight(1f)
                                .testTag("refresh_qr_button")
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("New 30s QR", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(
                            onClick = {
                                viewModel.scanQrAtEntranceCamera(
                                    rawQrToken = activeQrToken.opaqueToken,
                                    isTestScan = currentUser?.isTestRecord == true
                                )
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CamiqCyanPrimary, contentColor = Color(0xFF021820)),
                            modifier = Modifier
                                .weight(1f)
                                .testTag("present_qr_cam01_button")
                        ) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Scan at CAM-01", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                } else {
                    Button(
                        onClick = { viewModel.refreshStudentRotatingQr() },
                        colors = ButtonDefaults.buttonColors(containerColor = CamiqCyanPrimary, contentColor = Color(0xFF021820)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("generate_student_qr_button")
                    ) {
                        Icon(Icons.Default.QrCode2, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Generate Rotating 30s QR Credential", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // 3. Minimal Women's Safety SafeWalk Card + 3D Campus Digital Twin Preview
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "WOMEN'S SAFETY — SAFEWALK ESCORT",
                            style = MaterialTheme.typography.labelLarge,
                            color = CamiqEmeraldSafe
                        )
                        Text(
                            text = "Prefer Female Responder (never silently overridden)",
                            style = MaterialTheme.typography.bodySmall,
                            color = CamiqTextSecondary
                        )
                    }
                    Switch(checked = preferFemaleResponder, onCheckedChange = { preferFemaleResponder = it })
                }

                val activeWalk = safeWalks.firstOrNull { it.status != "COMPLETED_SAFE" }
                if (activeWalk != null) {
                    Surface(
                        color = CamiqCharcoalSurface,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "${activeWalk.sessionId} • ${activeWalk.status}",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = CamiqEmeraldSafe
                            )
                            Text(
                                text = "Responder: ${activeWalk.assignedGuardName.ifEmpty { "Waiting for Guard Acceptance" }}",
                                style = MaterialTheme.typography.labelSmall,
                                color = CamiqTextSecondary
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (activeWalk.status == "AWAITING_ALTERNATIVE_CONFIRMATION") {
                                    OutlinedButton(
                                        onClick = { viewModel.studentAcceptAlternativeResponder(activeWalk.sessionId) },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Allow Available Guard", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                                Button(
                                    onClick = { viewModel.studentCompleteSafeWalk(activeWalk.sessionId) },
                                    colors = ButtonDefaults.buttonColors(containerColor = CamiqEmeraldSafe, contentColor = Color.Black),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("I'm Safe (End Walk)", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                } else {
                    Button(
                        onClick = {
                            viewModel.requestSafeWalk(
                                startLabel = "Academic Block A",
                                startLat = defaultLat,
                                startLng = defaultLng,
                                destLabel = "Hostel Gate",
                                destLat = defaultLat + 0.00045,
                                destLng = defaultLng + 0.00045,
                                preferFemaleResponder = preferFemaleResponder,
                                liveLocationConsented = locationConsent,
                                checkInMinutes = 5,
                                isTestRecord = true
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CamiqEmeraldSafe, contentColor = Color(0xFF022014)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("request_safewalk_button")
                    ) {
                        Icon(Icons.Default.DirectionsWalk, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Request SafeWalk Security Escort", fontWeight = FontWeight.Bold)
                    }
                }

                CesiumDigitalTwinView(
                    sites = sites,
                    cameras = cameras,
                    incidents = incidents,
                    safeWalks = safeWalks,
                    laboratories = emptyList(),
                    height = 220.dp
                )
            }
        }
    }
}

package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.data.UserEntity
import com.example.ui.CamiqViewModel
import com.example.ui.components.StatusPill
import com.example.ui.components.TestBadge
import com.example.ui.theme.*

@Composable
fun CamiqAuthScreen(
    viewModel: CamiqViewModel,
    users: List<UserEntity>
) {
    var isRegisterTab by remember { mutableStateOf(users.isEmpty()) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf("ADMIN") }
    var studentIdCode by remember { mutableStateOf("") }
    var departmentName by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("FEMALE") }
    var markAsTest by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Hero Banner
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = CamiqCardSurface,
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqCyanPrimary.copy(alpha = 0.5f), RoundedCornerShape(18.dp))
        ) {
            Box(
                modifier = Modifier
                    .background(
                        Brush.linearGradient(
                            colors = listOf(Color(0xFF0A1428), Color(0xFF083344), Color(0xFF0F172A))
                        )
                    )
                    .padding(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = "CAMIQ Emblem",
                            tint = CamiqCyanBright,
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "CAMIQ",
                                style = MaterialTheme.typography.headlineLarge,
                                fontWeight = FontWeight.Bold,
                                color = CamiqTextPrimary
                            )
                            Text(
                                text = "Collaborative Intelligence for Existing Camera Infrastructure",
                                style = MaterialTheme.typography.bodySmall,
                                color = CamiqCyanBright
                            )
                        }
                    }

                    Text(
                        text = "From student distress to coordinated campus response.",
                        style = MaterialTheme.typography.titleMedium,
                        color = CamiqTextPrimary
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatusPill("1. CAMIQ SAFE (/student)", CamiqCyanDim, CamiqCyanBright)
                        StatusPill("2. CAMIQ RESPONSE (/guard)", CamiqEmeraldContainer, CamiqEmeraldSafe)
                    }
                    StatusPill("3. CAMIQ COMMAND (/admin)", CamiqAmberContainer, CamiqAmberWarning)
                }
            }
        }

        // Database Truthfulness Status Card
        Surface(
            color = CamiqCharcoalSurface,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(14.dp))
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "UNIFIED DATABASE STATE",
                        style = MaterialTheme.typography.labelLarge,
                        color = CamiqCyanBright
                    )
                    StatusPill(
                        text = "${users.size} REGISTERED ACCOUNTS",
                        containerColor = CamiqElevatedSurface,
                        contentColor = CamiqTextPrimary
                    )
                }
                Text(
                    text = if (users.isEmpty()) {
                        "Fresh installation: 0 seeded accounts, 0 fake incidents, 0 simulated streams. Register your first account below or use ROLE PREVIEW above to inspect all three interfaces."
                    } else {
                        "Select an existing account below to sign in, or register a new Student, Security Guard, or Administrator."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = CamiqTextSecondary
                )
            }
        }

        // Login / Registration Card
        Surface(
            color = CamiqCardSurface,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CamiqBorder, RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = { isRegisterTab = false },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (!isRegisterTab) CamiqCyanPrimary else CamiqElevatedSurface,
                            contentColor = if (!isRegisterTab) Color(0xFF021820) else CamiqTextSecondary
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("tab_sign_in")
                    ) {
                        Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Sign In")
                    }

                    Button(
                        onClick = { isRegisterTab = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isRegisterTab) CamiqCyanPrimary else CamiqElevatedSurface,
                            contentColor = if (isRegisterTab) Color(0xFF021820) else CamiqTextSecondary
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("tab_register")
                    ) {
                        Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Create Account")
                    }
                }

                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("auth_username_input")
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password (SHA-256 hashed)") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("auth_password_input")
                )

                if (isRegisterTab) {
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text("Full Name") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("auth_fullname_input")
                    )

                    Text(
                        text = "Select Role (Routes to /student, /guard, or /admin):",
                        style = MaterialTheme.typography.labelMedium,
                        color = CamiqTextSecondary
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        listOf("STUDENT", "GUARD", "ADMIN").forEach { roleOption ->
                            FilterChip(
                                selected = selectedRole == roleOption,
                                onClick = { selectedRole = roleOption },
                                label = { Text(roleOption) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    if (selectedRole == "STUDENT") {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = studentIdCode,
                                onValueChange = { studentIdCode = it },
                                label = { Text("Student ID (e.g. STU-2026-01)") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = departmentName,
                                onValueChange = { departmentName = it },
                                label = { Text("Department") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    if (selectedRole == "GUARD" || selectedRole == "STUDENT") {
                        Text(
                            text = "Responder / User Gender (Used for SafeWalk Female Responder Matching):",
                            style = MaterialTheme.typography.labelSmall,
                            color = CamiqTextSecondary
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("FEMALE", "MALE", "OTHER").forEach { g ->
                                FilterChip(
                                    selected = gender == g,
                                    onClick = { gender = g },
                                    label = { Text(g) }
                                )
                            }
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { markAsTest = !markAsTest }
                    ) {
                        Checkbox(checked = markAsTest, onCheckedChange = { markAsTest = it })
                        Text(
                            text = "Label this account as TEST record",
                            style = MaterialTheme.typography.bodySmall,
                            color = CamiqTextSecondary
                        )
                    }

                    Button(
                        onClick = {
                            viewModel.registerAndLogin(
                                username = username,
                                passwordPlain = password,
                                fullName = fullName,
                                role = selectedRole,
                                studentIdCode = studentIdCode,
                                departmentName = departmentName,
                                gender = gender,
                                isTestRecord = markAsTest
                            )
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CamiqCyanPrimary,
                            contentColor = Color(0xFF021820)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("register_submit_button")
                    ) {
                        Icon(Icons.Default.VerifiedUser, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Create $selectedRole Account & Enter CAMIQ", fontWeight = FontWeight.Bold)
                    }
                } else {
                    Button(
                        onClick = { viewModel.login(username, password) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CamiqCyanPrimary,
                            contentColor = Color(0xFF021820)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("login_submit_button")
                    ) {
                        Icon(Icons.Default.LockOpen, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Sign In & Route by Role", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Registered Real Accounts Directory (if any created by Admin or User)
        if (users.isNotEmpty()) {
            Surface(
                color = CamiqCharcoalSurface,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, CamiqBorder, RoundedCornerShape(14.dp))
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "EXISTING ACCOUNTS IN DATABASE (TAP TO AUTO-FILL USERNAME)",
                        style = MaterialTheme.typography.labelMedium,
                        color = CamiqCyanBright
                    )
                    users.forEach { u ->
                        Surface(
                            color = CamiqCardSurface,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    isRegisterTab = false
                                    username = u.username
                                }
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.padding(10.dp)
                            ) {
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "${u.fullName} (@${u.username})",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.SemiBold,
                                            color = CamiqTextPrimary
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        TestBadge(u.isTestRecord)
                                    }
                                    Text(
                                        text = "Role: ${u.role} • Gate State: ${u.campusPresenceState}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = CamiqTextSecondary
                                    )
                                }
                                StatusPill(
                                    text = u.role,
                                    containerColor = CamiqCyanDim,
                                    contentColor = CamiqCyanBright
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

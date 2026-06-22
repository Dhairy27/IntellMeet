const API_BASE = 'http://localhost:5000/api';

async function runRecordingsTest() {
  console.log('==================================================');
  console.log('   INTELLMEET RECORDINGS ENDPOINT TEST            ');
  console.log('==================================================\n');

  const timestamp = Date.now();
  const testUser = {
    name: 'Recordings Tester',
    email: `rec_test_${timestamp}@intellmeet.com`,
    password: 'Password123!',
    firstName: 'Rec'
  };

  console.log('[Test] Registering test user...');
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  const regData = await regRes.json();
  const token = regData.data.accessToken;
  const workspaceId = regData.data.workspace._id;
  console.log(`✔ User registered. Token acquired.\n`);

  console.log('[Test] Creating a meeting...');
  const meetRes = await fetch(`${API_BASE}/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: 'Post-Meeting Recording Test',
      description: 'Verifying real recordings collections',
      workspaceId,
      status: 'scheduled'
    })
  });
  const meetData = await meetRes.json();
  const meetingId = meetData.data._id;
  console.log(`✔ Meeting created. ID: ${meetingId}\n`);

  // End meeting
  console.log('[Test] Ending meeting (should have NO recordings now)...');
  const endRes = await fetch(`${API_BASE}/meetings/${meetingId}/end`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  const endData = await endRes.json();
  console.log(`✔ Meeting ended. Status: ${endData.data.status}`);
  console.log(`✔ Meeting recordingUrl (compatibility field): "${endData.data.recordingUrl}" (should be empty)\n`);

  // Fetch recordings
  console.log('[Test] Fetching recordings (expecting empty array)...');
  const getRes = await fetch(`${API_BASE}/meetings/${meetingId}/recordings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getData = await getRes.json();
  console.log(`✔ Recordings count in database: ${getData.data.length}`);
  const initialCountOk = getData.data.length === 0;
  console.log(`✔ Initial recordings empty check: ${initialCountOk ? '🟢 PASSED' : '🔴 FAILED'}\n`);

  // Create recording
  console.log('[Test] Adding a real recording to the meeting...');
  const postRes = await fetch(`${API_BASE}/meetings/${meetingId}/recordings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      recordingUrl: 'https://res.cloudinary.com/demo/video/upload/custom_recording.mp4',
      fileSize: 1048576 * 20, // 20MB
      duration: 600 // 10 minutes
    })
  });
  const postData = await postRes.json();
  console.log(`✔ Recording added. URL: ${postData.data.recordingUrl}`);
  const addOk = postData.success && postData.data.recordingUrl === 'https://res.cloudinary.com/demo/video/upload/custom_recording.mp4';
  console.log(`✔ Add recording check: ${addOk ? '🟢 PASSED' : '🔴 FAILED'}\n`);

  // Fetch recordings again
  console.log('[Test] Fetching recordings again (expecting 1 record)...');
  const getRes2 = await fetch(`${API_BASE}/meetings/${meetingId}/recordings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getData2 = await getRes2.json();
  console.log(`✔ Recordings count in database: ${getData2.data.length}`);
  const finalCountOk = getData2.data.length === 1 && getData2.data[0].recordingUrl === 'https://res.cloudinary.com/demo/video/upload/custom_recording.mp4';
  console.log(`✔ Final recordings list check: ${finalCountOk ? '🟢 PASSED' : '🔴 FAILED'}\n`);

  console.log('==================================================');
  console.log('   RECORDINGS TEST SUMMARY                        ');
  console.log('==================================================');
  const allPassed = initialCountOk && addOk && finalCountOk;
  console.log(`Final Status: ${allPassed ? '🟢 SUCCESS' : '🔴 FAILED'}`);
  console.log('==================================================\n');

  if (allPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRecordingsTest().catch(console.error);

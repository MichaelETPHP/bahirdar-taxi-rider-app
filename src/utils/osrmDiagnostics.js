/**
 * OSRM Diagnostics Utility
 * Helps debug OSRM connectivity issues
 */

/**
 * Test OSRM server connectivity
 */
export async function testOSRMConnection(osrmUrl) {
  try {
    console.log(`📡 Testing OSRM connection to: ${osrmUrl}`);

    // Simple test request to OSRM status endpoint
    const statusUrl = `${osrmUrl}/status`;
    const response = await fetch(statusUrl, { timeout: 5000 });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ OSRM Server is ONLINE:', {
        status: data.status,
        code: data.code,
      });
      return true;
    } else {
      console.error('❌ OSRM Server returned error:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ OSRM connection failed:', error.message);
    return false;
  }
}

/**
 * Test OSRM routing with sample coordinates
 */
export async function testOSRMRoute(osrmUrl) {
  try {
    console.log(`🛣️  Testing OSRM routing...`);

    // Addis Ababa coordinates (test route)
    const originLng = 38.7469;
    const originLat = 9.0192;
    const destLng = 38.7650;
    const destLat = 9.0350;

    const url = `${osrmUrl}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
    });

    const fullUrl = `${url}?${params}`;
    console.log('   URL:', fullUrl);

    const response = await fetch(fullUrl, { timeout: 5000 });

    if (!response.ok) {
      console.error('❌ Route request failed:', response.status);
      return false;
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      const route = data.routes[0];
      const waypointCount = route.geometry?.coordinates?.length || 0;
      console.log('✅ OSRM routing WORKS:', {
        status: data.code,
        distance: `${(route.distance / 1000).toFixed(2)} km`,
        duration: `${Math.round(route.duration / 60)} min`,
        waypoints: waypointCount,
      });
      return true;
    } else {
      console.error('❌ Route request returned error:', data.code, data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Route test failed:', error.message);
    return false;
  }
}

/**
 * Run full OSRM diagnostics
 */
export async function runOSRMDiagnostics() {
  console.log('\n🔧 Starting OSRM Diagnostics...\n');

  const osrmAddisUrl = 'http://192.168.1.8:5000';
  const osrmBahirdarUrl = 'http://192.168.1.8:5001';

  console.log('Testing Addis Ababa OSRM (port 5000)...');
  const addisOk = await testOSRMConnection(osrmAddisUrl);
  if (addisOk) {
    await testOSRMRoute(osrmAddisUrl);
  }

  console.log('\nTesting Bahir Dar OSRM (port 5001)...');
  const bahirdarOk = await testOSRMConnection(osrmBahirdarUrl);
  if (bahirdarOk) {
    await testOSRMRoute(osrmBahirdarUrl);
  }

  console.log('\n📋 Diagnostics Summary:');
  console.log(`  Addis OSRM (5000): ${addisOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`  Bahir Dar OSRM (5001): ${bahirdarOk ? '✅ OK' : '❌ FAILED'}`);

  if (!addisOk && !bahirdarOk) {
    console.log('\n⚠️  Both OSRM servers are not responding!');
    console.log('   Make sure Docker containers are running:');
    console.log('   docker ps | grep osrm');
    console.log('\n   If containers exist, check if they\'re bound to 0.0.0.0:');
    console.log('   docker logs <container-id>');
  }

  return addisOk || bahirdarOk;
}

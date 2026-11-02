import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { query, transaction, closePool } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import { runMigrations } from './migrate.js';
import { seedStops, seedRoutes, seedKeywords } from './seeds/seed_data.js';

export async function runSeeds() {
  console.log('🌱 [Seeder] Starting AutoPath database seeding...');

  // Ensure migrations are run first
  await runMigrations();

  await transaction(async (client) => {
    // 1. Seed Default Administrator
    console.log('👤 [Seeder] Seeding default administrator...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(config.admin.password, salt);

    await client.query(`
      INSERT INTO admins (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        email = EXCLUDED.email
    `, [config.admin.username, config.admin.email, passwordHash, 'admin']);

    console.log(`   ✓ Admin user '${config.admin.username}' created / updated.`);

    // 2. Seed Auto Stands / Stops
    console.log(`🚏 [Seeder] Seeding ${seedStops.length} auto stands...`);
    for (const stand of seedStops) {
      await client.query(`
        INSERT INTO stops (
          id, stop_name, bengali_name, hindi_name, full_name, full_bengali_name,
          latitude, longitude, coords_description, service_span, stand_format,
          queue_system, tier, active_lines_count, has_live_dispatch, tagline,
          tagline_bengali, landmarks, is_stand, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20
        )
        ON CONFLICT (id) DO UPDATE SET
          stop_name = EXCLUDED.stop_name,
          bengali_name = EXCLUDED.bengali_name,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          landmarks = EXCLUDED.landmarks,
          is_active = TRUE
      `, [
        stand.id,
        stand.name,
        stand.bengaliName || stand.name,
        stand.hindiName || '',
        stand.fullName || `${stand.name} Auto Stand`,
        stand.fullBengaliName || `${stand.bengaliName || stand.name} অটো স্ট্যান্ড`,
        stand.coordinates[0],
        stand.coordinates[1],
        stand.coordsDescription || '',
        stand.serviceSpan || '05:30 AM – Midnight',
        stand.standFormat || 'Auto Stand',
        stand.queueSystem || 'Union Regulated',
        stand.tier || 'ACTIVE AUTO HUB',
        stand.activeLinesCount || 0,
        Boolean(stand.hasLiveDispatch),
        stand.tagline || '',
        stand.taglineBengali || '',
        JSON.stringify(stand.landmarks || []),
        true,
        true
      ]);
    }
    console.log(`   ✓ All ${seedStops.length} auto stands seeded.`);

    // 3. Seed Routes, Intermediate Points, and Stops
    console.log(`🛣️  [Seeder] Seeding ${seedRoutes.length} auto corridors and exact coordinates...`);
    for (const route of seedRoutes) {
      // Upsert route
      await client.query(`
        INSERT INTO routes (
          id, route_code, route_code_alt, route_name, subtitle,
          bengali_name, bengali_subtitle, hindi_name,
          source_stop_id, destination_stop_id,
          fare_range, fare_fixed, govt_share_fare, fare_type,
          distance, distance_km, est_travel, est_travel_min,
          queue_freq, is_direct, is_recommended, route_type,
          category, status, notes, is_active
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21, $22,
          $23, $24, $25, $26
        )
        ON CONFLICT (id) DO UPDATE SET
          route_name = EXCLUDED.route_name,
          source_stop_id = EXCLUDED.source_stop_id,
          destination_stop_id = EXCLUDED.destination_stop_id,
          distance = EXCLUDED.distance,
          distance_km = EXCLUDED.distance_km,
          fare_fixed = EXCLUDED.fare_fixed,
          is_active = TRUE
      `, [
        route.id,
        route.code || 'AK-AUTO',
        route.codeAlt || '',
        route.name,
        route.subtitle || '',
        route.bengaliName || route.name,
        route.bengaliSubtitle || '',
        route.hindiName || '',
        route.originStandId,
        route.destinationStandId,
        route.fareRange || '₹12 - ₹15',
        route.fareFixed || '₹15 Fixed',
        route.govtShareFare || '',
        route.fareType || 'Per Seat Share',
        route.distance || '~4.0 km',
        route.distanceKm || 4.0,
        route.estTravel || '15-20m',
        route.estTravelMin || 18,
        route.queueFreq || '2-4 min',
        route.isDirect !== false,
        Boolean(route.isRecommended),
        route.routeType || 'direct',
        route.category || '',
        route.status || 'Active Queue Now',
        route.notes || '',
        true
      ]);

      // Seed exact intermediate road coordinates
      if (Array.isArray(route.pathCoordinates) && route.pathCoordinates.length > 0) {
        // Clear previous points for this route
        await client.query('DELETE FROM route_points WHERE route_id = $1', [route.id]);

        for (let i = 0; i < route.pathCoordinates.length; i++) {
          const pt = route.pathCoordinates[i];
          const seq = i + 1;
          await client.query(`
            INSERT INTO route_points (route_id, sequence_number, latitude, longitude)
            VALUES ($1, $2, $3, $4)
          `, [route.id, seq, pt[0], pt[1]]);
        }
      }

      // Seed intermediate passenger boarding stops
      if (Array.isArray(route.stops) && route.stops.length > 0) {
        await client.query('DELETE FROM route_stops WHERE route_id = $1', [route.id]);

        for (let i = 0; i < route.stops.length; i++) {
          const s = route.stops[i];
          const order = s.order || (i + 1);
          await client.query(`
            INSERT INTO route_stops (
              route_id, stop_id, stop_name, bengali_name, order_index,
              latitude, longitude, distance, dist_km, badge, badge_icon, subtext, is_stand
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            route.id,
            s.id,
            s.name,
            s.bengaliName || s.name,
            order,
            s.coordinates ? s.coordinates[0] : (s.latitude || 22.5),
            s.coordinates ? s.coordinates[1] : (s.longitude || 88.3),
            s.distance || '',
            s.distKm || 0.0,
            s.badge || null,
            s.badgeIcon || null,
            s.subtext || '',
            Boolean(s.isStand)
          ]);
        }
      }
    }
    console.log(`   ✓ All ${seedRoutes.length} corridors and coordinates seeded successfully.`);

    // 4. Seed Search Autocomplete Suggestions
    if (Array.isArray(seedKeywords) && seedKeywords.length > 0) {
      console.log(`🔍 [Seeder] Seeding ${seedKeywords.length} autocomplete suggestions...`);
      for (const item of seedKeywords) {
        await client.query(`
          INSERT INTO search_keywords (name, bengali_name, subtext, type, category, related_stand_id, keywords)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          item.name,
          item.bengaliName || item.name,
          item.subtext || '',
          item.type || 'stand',
          item.category || 'hub',
          item.standId || null,
          item.keywords || []
        ]);
      }
    }
  });

  console.log('🎉 [Seeder] Database seeding finished successfully!');
}

// If executed directly from CLI: npm run seed
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeeds()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      await closePool();
      process.exit(1);
    });
}


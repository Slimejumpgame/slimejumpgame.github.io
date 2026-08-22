(() => {
  "use strict";

  const ACHIEVEMENTS_STORAGE_KEY = "slimejumperAchievements";
  const SELECTED_ACHIEVEMENT_BADGES_STORAGE_KEY =
    "slimejumperSelectedAchievementBadges";
  const CALLING_CARD_BADGES_CONFIGURED_STORAGE_KEY =
    "slimejumperCallingCardBadgesConfigured";
  const CALLING_CARD_BADGE_LIMIT = 5;
  const ACHIEVEMENT_PROGRESS_STORAGE_KEY = "slimejumperAchievementProgress";
  const ACHIEVEMENT_PROGRESS_VERSION_STORAGE_KEY = "slimejumperAchievementProgressVersion";
  const ACHIEVEMENT_PROGRESS_VERSION = "achievements-v1";
  const STAR_BALANCE_STORAGE_KEY = "slimejumperStarBalance";
  const STAR_ECONOMY_VERSION_STORAGE_KEY = "slimejumperStarEconomyVersion";
  const STAR_ECONOMY_VERSION = "star-economy-v1";
  const STAR_AWARD_RECEIPTS_STORAGE_KEY = "slimejumperStarAwardReceiptsV1";
  const STAR_AWARD_RECEIPTS_VERSION = 1;
  const WARDROBE_ITEM_STAR_PRICE = 250;
  const DEV_SHOP_TEST_INITIAL_BALANCE = 1000;

  const ACHIEVEMENT_REGISTRY = Object.freeze([
    Object.freeze({id: "hp_gen", icon: "❤️", name: "HP GEN", description: "Schaffe 3 Perfects direkt hintereinander.", secret: false}),
    Object.freeze({id: "perfectionist", icon: "🎯", name: "PERFECTIONIST", description: "Schaffe 5 Perfects direkt hintereinander.", secret: false}),
    Object.freeze({id: "untouchable", icon: "🔥", name: "UNTOUCHABLE", description: "Schaffe 10 Perfects direkt hintereinander.", secret: false}),
    Object.freeze({id: "starstruck", icon: "⭐", name: "STARSTRUCK", description: "Sammle 50 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "star_hoarder", icon: "🌟", name: "STAR HOARDER", description: "Sammle 100 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "galaxy_brain", icon: "💫", name: "GALAXY BRAIN", description: "Sammle 200 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "not_today", icon: "😅", name: "NOT TODAY", description: "Schließe ein Level mit kritisch wenig Slime-Health ab.", secret: false}),
    Object.freeze({id: "clean_run", icon: "🧼", name: "CLEAN RUN", description: "Schließe 10 Level hintereinander ab, ohne zu sterben.", secret: false}),
    Object.freeze({id: "ghostbuster", icon: "👻", name: "GHOSTBUSTER", description: "Schließe ein Geister-Level ab, ohne von einem Geist getroffen zu werden.", secret: false}),
    Object.freeze({id: "speed_slime", icon: "⚡", name: "SPEED SLIME", description: "Schließe ein Level in höchstens 5 Sekunden ab.", secret: false}),
    Object.freeze({id: "bounce_master", icon: "🛝", name: "BOUNCE MASTER", description: "Nutze 3 Bounce-Pads in Folge, ohne normal zu landen.", secret: false}),
    Object.freeze({id: "ice_cold", icon: "🧊", name: "ICE COLD", description: "Schließe ein Schneewelt-Level ab, ohne zu sterben.", secret: false}),
    Object.freeze({id: "hot_stuff", icon: "🌋", name: "HOT STUFF", description: "Schließe ein Vulkan-Level ab, ohne zu sterben.", secret: false}),
    Object.freeze({id: "head_in_the_clouds", icon: "☁️", name: "HEAD IN THE CLOUDS", description: "Erreiche erstmals die Himmelswelt.", secret: false}),
    Object.freeze({id: "world_traveler", icon: "🌍", name: "WORLD TRAVELER", description: "Erreiche alle existierenden Biome.", secret: false}),
    Object.freeze({id: "round_two", icon: "🔁", name: "ROUND TWO", description: "Schließe eine komplette Biomrotation ab und mache Runde zwei bereit.", secret: false}),
    Object.freeze({id: "fashion_slime", icon: "👑", name: "FASHION SLIME", description: "Schalte mindestens einen normalen Hut frei.", secret: false}),
    Object.freeze({id: "glorious_beard", icon: "🧔", name: "GLORIOUS BEARD", description: "Schalte mindestens einen Bart frei.", secret: false}),
    Object.freeze({id: "dressed_to_slime", icon: "🎩", name: "DRESSED TO SLIME", description: "Trage gleichzeitig einen Hut und einen Bart.", secret: false}),
    Object.freeze({id: "wardrobe_warrior", icon: "🛍️", name: "WARDROBE WARRIOR", description: "Besitze mindestens 25 freischaltbare Garderoben-Items.", secret: false}),
    Object.freeze({id: "rainbow_slime", icon: "🌈", name: "RAINBOW SLIME", description: "Schalte alle vorhandenen Slime-Farben frei.", secret: false}),
    Object.freeze({id: "perfect_clear", icon: "✅", name: "PERFECT CLEAR", description: "Sammle alle Sterne eines Levels und erreiche das Ziel.", secret: false}),
    Object.freeze({id: "long_haul", icon: "🚚", name: "LONG HAUL", description: "Schließe 25 Level in einem Run ab.", secret: false}),
    Object.freeze({id: "empty_handed", icon: "🕳️", name: "EMPTY HANDED", description: "Schließe ein Level ab, ohne einen Stern einzusammeln.", secret: false}),
    Object.freeze({id: "full_wardrobe", icon: "🎨", name: "FULL WARDROBE", description: "Schalte deine komplette Garderobe frei.", secret: false}),
    Object.freeze({id: "fashion_icon", icon: "🕶️", name: "FASHION ICON", description: "Schalte alle Hüte frei.", secret: false}),
    Object.freeze({id: "beard_baron", icon: "🤴", name: "BEARD BARON", description: "Schalte alle Bärte frei.", secret: false}),
    Object.freeze({id: "marathon_slime", icon: "🏃", name: "MARATHON SLIME", description: "Schließe 50 Level in einem Run ab.", secret: false}),
    Object.freeze({id: "century_slime", icon: "💯", name: "CENTURY SLIME", description: "Schließe 100 Level in einem Run ab.", secret: false}),
    Object.freeze({id: "clean_machine", icon: "⚙️", name: "CLEAN MACHINE", description: "Schließe 25 Level hintereinander ohne Tod ab.", secret: false}),
    Object.freeze({id: "ghost_whisperer", icon: "🔮", name: "GHOST WHISPERER", description: "Schaffe 5 Geister-Level in einem Run ohne getroffen zu werden.", secret: false}),
    Object.freeze({id: "bounce_addict", icon: "🏀", name: "BOUNCE ADDICT", description: "Schaffe 10 Bounce-Kontakte ohne normale Landung.", secret: false}),
    Object.freeze({id: "perfect_tourist", icon: "📸", name: "PERFECT TOURIST", description: "Schaffe in jedem Biom mindestens ein Perfect.", secret: false}),
    Object.freeze({id: "biome_master", icon: "🗺️", name: "BIOME MASTER", description: "Schließe jedes Biom mindestens einmal ohne Tod ab.", secret: false}),
    Object.freeze({id: "speed_demon", icon: "😈", name: "SPEED DEMON", description: "Schaffe 3 Level in einem Run in höchstens 5 Sekunden.", secret: false}),
    Object.freeze({id: "clean_sweep", icon: "🧹", name: "CLEAN SWEEP", description: "Schaffe 3 Perfect Clears in einem Run.", secret: false}),
    Object.freeze({id: "star_magnet", icon: "🧲", name: "STAR MAGNET", description: "Sammle 300 Sterne in einem Run.", secret: false}),
    Object.freeze({id: "star_bank", icon: "🏦", name: "STAR BANK", description: "Sammle insgesamt 1.000 Sterne.", secret: false}),
    Object.freeze({id: "frequent_flyer", icon: "✈️", name: "FREQUENT FLYER", description: "Verbringe insgesamt 60 Sekunden in der Luft.", secret: false}),
    Object.freeze({id: "style_master", icon: "✨", name: "STYLE MASTER", description: "Beende 10 Level mit 10 verschiedenen Looks.", secret: false}),
    Object.freeze({id: "perfect_25", icon: "🏅", name: "PERFECT 25", description: "Schaffe insgesamt 25 Perfects.", secret: false}),
    Object.freeze({id: "veteran_slime", icon: "🏁", name: "VETERAN SLIME", description: "Schließe insgesamt 100 Level ab.", secret: false}),
    Object.freeze({id: "ouch", icon: "💀", name: "OUCH!", description: "Stirb insgesamt 25-mal.", secret: false}),
    Object.freeze({id: "achievement_hunter", icon: "🏆", name: "ACHIEVEMENT HUNTER", description: "Schalte alle Achievements außer dem finalen Secret frei.", secret: false}),
    Object.freeze({id: "secret_one_shot", icon: "🏹", name: "ONE SHOT WONDER", description: "Schaffe ein Level mit nur einem Schuss.", secret: true}),
    Object.freeze({id: "secret_star_sniper", icon: "🌠", name: "STAR SNIPER", description: "Sammle 3 Sterne mit einem einzigen Schuss.", secret: true}),
    Object.freeze({id: "secret_second_chance", icon: "🩹", name: "SECOND CHANCE", description: "Nutze deine zweite Chance und erreiche trotzdem das Ziel.", secret: true}),
    Object.freeze({id: "secret_air_time", icon: "🛸", name: "AIR TIME", description: "Bleib 5 Sekunden in der Luft und lande sicher.", secret: true}),
    Object.freeze({id: "secret_ragequitter", icon: "🤬", name: "RAGEQUITTER", description: "Stirb 3-mal innerhalb von 5 Sekunden.", secret: true}),
    Object.freeze({id: "secret_groundhog_slime", icon: "⏰", name: "GROUNDHOG SLIME", description: "Stirb 5-mal im selben Level und schaffe es danach trotzdem.", secret: true}),
    Object.freeze({id: "secret_take_your_time", icon: "🐌", name: "TAKE YOUR TIME", description: "Schließe ein Level erst nach 120 Sekunden ohne Tod ab.", secret: true}),
    Object.freeze({id: "slime_scholar", icon: "📗", name: "SLIME SCHOLAR", description: "Erreiche Spielerlevel 10.", secret: false, conditionKey: "player-level-10", category: "player-level"}),
    Object.freeze({id: "rising_prodigy", icon: "📈", name: "RISING PRODIGY", description: "Erreiche Spielerlevel 25.", secret: false, conditionKey: "player-level-25", category: "player-level"}),
    Object.freeze({id: "halfway_to_prestige", icon: "🌓", name: "HALFWAY TO PRESTIGE", description: "Erreiche Spielerlevel 50.", secret: false, conditionKey: "player-level-50", category: "player-level"}),
    Object.freeze({id: "upper_class_slime", icon: "🎓", name: "UPPER CLASS SLIME", description: "Erreiche Spielerlevel 75.", secret: false, conditionKey: "player-level-75", category: "player-level"}),
    Object.freeze({id: "level_cap", icon: "🧗", name: "LEVEL CAP", description: "Erreiche Spielerlevel 100.", secret: false, conditionKey: "player-level-100", category: "player-level"}),
    Object.freeze({id: "ready_to_ascend", icon: "🚀", name: "READY TO ASCEND", description: "Fülle auf Spielerlevel 100 auch den letzten XP-Balken.", secret: false, conditionKey: "player-prestige-ready", category: "player-level"}),
    Object.freeze({id: "meadow_graduate", icon: "🥾", name: "MEADOW GRADUATE", description: "Schließe Map-Level 10 ab.", secret: false, conditionKey: "map-level-10-complete", category: "map-level"}),
    Object.freeze({id: "old_world_complete", icon: "🌅", name: "OLD WORLD COMPLETE", description: "Schließe Map-Level 100 ab.", secret: false, conditionKey: "map-level-100-complete", category: "map-level"}),
    Object.freeze({id: "worlds_end", icon: "🧭", name: "WORLD'S END", description: "Schließe Map-Level 200 ab.", secret: false, conditionKey: "map-level-200-complete", category: "map-level"}),
    Object.freeze({id: "beyond_the_map", icon: "🏔️", name: "BEYOND THE MAP", description: "Schließe Map-Level 300 ab.", secret: false, conditionKey: "map-level-300-complete", category: "map-level"}),
    Object.freeze({id: "storm_chaser", icon: "⛈️", name: "STORM CHASER", description: "Erreiche erstmals Storm Night.", secret: false, conditionKey: "reach-biome-stormNight", category: "biome"}),
    Object.freeze({id: "temple_threshold", icon: "🪔", name: "TEMPLE THRESHOLD", description: "Erreiche erstmals den Underground Temple.", secret: false, conditionKey: "reach-biome-undergroundTemple", category: "biome"}),
    Object.freeze({id: "after_dark", icon: "🌙", name: "AFTER DARK", description: "Entdecke Night, Storm Night, Bamboo Night und Red Moon.", secret: false, conditionKey: "discover-four-night-biomes", category: "biome"}),
    Object.freeze({id: "cave_connoisseur", icon: "⛏️", name: "CAVE CONNOISSEUR", description: "Schaffe ein Perfect in allen vier Höhlen- und Tiefenbiomen.", secret: false, conditionKey: "perfect-four-cave-biomes", category: "biome"}),
    Object.freeze({id: "new_world_perfection", icon: "🗾", name: "NEW WORLD PERFECTION", description: "Schaffe in jedem Biom der zweiten Welthälfte ein Perfect.", secret: false, conditionKey: "perfect-biomes-11-through-20", category: "biome"}),
    Object.freeze({id: "secret_pirates_code", icon: "🏴‍☠️", name: "PIRATE'S CODE", description: "Schaffe im Pirate Harbor ein Perfect mit genau einem Schuss.", secret: true, conditionKey: "pirateHarbor-perfect-one-shot", category: "secret-situation"}),
    Object.freeze({id: "secret_first_contact", icon: "👽", name: "FIRST CONTACT", description: "Schaffe im Alien Jungle ein Perfect im grünen Standardlook.", secret: true, conditionKey: "alienJungle-perfect-green-none-none", category: "secret-situation"}),
    Object.freeze({id: "secret_blood_moon", icon: "🩸", name: "BLOOD MOON", description: "Schaffe bei Red Moon ein Perfect mit nur einem übrigen Leben.", secret: true, conditionKey: "redMoon-perfect-one-life", category: "secret-situation"}),
    Object.freeze({id: "secret_temple_raider", icon: "🏺", name: "TEMPLE RAIDER", description: "Entkomme dem Underground Temple ohne Tod und ohne Sterne.", secret: true, conditionKey: "undergroundTemple-zero-stars-no-death", category: "secret-situation"}),
    Object.freeze({id: "golden_ticket", icon: "🎫", name: "GOLDEN TICKET", description: "Besitze den Gold-Slime – durch Kauf oder Mastery.", secret: false, conditionKey: "owns-gold-slime", category: "gold"}),
    Object.freeze({id: "true_alchemy", icon: "⚗️", name: "TRUE ALCHEMY", description: "Schalte die echte Gold-Slime-Mastery frei.", secret: false, conditionKey: "gold-slime-mastery", category: "gold"}),
    Object.freeze({id: "crowned_in_gold", icon: "🥇", name: "CROWNED IN GOLD", description: "Schalte die Gold-Hut-Mastery frei.", secret: false, conditionKey: "gold-hat-mastery", category: "gold"}),
    Object.freeze({id: "beard_of_midas", icon: "🏵️", name: "BEARD OF MIDAS", description: "Schalte die Gold-Bart-Mastery frei.", secret: false, conditionKey: "gold-beard-mastery", category: "gold"}),
    Object.freeze({id: "gold_rush", icon: "🤑", name: "GOLD RUSH", description: "Kaufe deinen ersten Gold-Hut.", secret: false, conditionKey: "purchased-first-gold-hat", category: "gold"}),
    Object.freeze({id: "bullion_barber", icon: "✂️", name: "BULLION BARBER", description: "Kaufe deinen ersten Gold-Bart.", secret: false, conditionKey: "purchased-first-gold-beard", category: "gold"}),
    Object.freeze({id: "all_that_glitters", icon: "💎", name: "ALL THAT GLITTERS", description: "Besitze den Gold-Slime und alle Gold-Hüte und Gold-Bärte.", secret: false, conditionKey: "own-complete-gold-wardrobe", category: "gold"}),
    Object.freeze({id: "secret_gold_standard", icon: "⚜️", name: "GOLD STANDARD", description: "Schließe ein Level komplett in Gold gekleidet ab.", secret: true, conditionKey: "complete-with-gold-slime-hat-beard", category: "secret-situation"}),
    Object.freeze({id: "first_ascent", icon: "🛫", name: "FIRST ASCENT", description: "Erreiche Prestige 1.", secret: false, conditionKey: "prestige-1", category: "prestige"}),
    Object.freeze({id: "seasoned_soul", icon: "🥉", name: "SEASONED SOUL", description: "Erreiche Prestige 3.", secret: false, conditionKey: "prestige-3", category: "prestige"}),
    Object.freeze({id: "high_society", icon: "🏰", name: "HIGH SOCIETY", description: "Erreiche Prestige 5.", secret: false, conditionKey: "prestige-5", category: "prestige"}),
    Object.freeze({id: "beyond_mortal", icon: "🪐", name: "BEYOND MORTAL", description: "Erreiche Prestige 8.", secret: false, conditionKey: "prestige-8", category: "prestige"}),
    Object.freeze({id: "prestige_legend", icon: "🛡️", name: "PRESTIGE LEGEND", description: "Erreiche Prestige 10.", secret: false, conditionKey: "prestige-10", category: "prestige"}),
    Object.freeze({id: "forever_fashionable", icon: "🔒", name: "FOREVER FASHIONABLE", description: "Wähle dein erstes permanentes Prestige-Garderobenitem.", secret: false, conditionKey: "permanent-wardrobe-unlocks-1", category: "wardrobe"}),
    Object.freeze({id: "three_of_a_kind", icon: "🧵", name: "THREE OF A KIND", description: "Besitze je einen permanenten Farb-, Hut- und Bart-Unlock.", secret: false, conditionKey: "permanent-unlock-each-category", category: "wardrobe"}),
    Object.freeze({id: "heirloom_collection", icon: "🗄️", name: "HEIRLOOM COLLECTION", description: "Besitze 5 permanente Prestige-Garderobenitems.", secret: false, conditionKey: "permanent-wardrobe-unlocks-5", category: "wardrobe"}),
    Object.freeze({id: "legacy_closet", icon: "🏛️", name: "LEGACY CLOSET", description: "Besitze 10 permanente Prestige-Garderobenitems.", secret: false, conditionKey: "permanent-wardrobe-unlocks-10", category: "wardrobe"}),
    Object.freeze({id: "perk_up", icon: "🧩", name: "PERK UP", description: "Schalte deinen ersten Perk frei.", secret: false, conditionKey: "unlocked-perks-1", category: "perks"}),
    Object.freeze({id: "fully_loaded", icon: "🧰", name: "FULLY LOADED", description: "Schalte alle implementierten Perks frei.", secret: false, conditionKey: "unlocked-all-implemented-perks", category: "perks"}),
    Object.freeze({id: "triple_threat", icon: "🃏", name: "TRIPLE THREAT", description: "Rüste gleichzeitig 3 Perks aus.", secret: false, conditionKey: "selected-perks-3", category: "perks"}),
    Object.freeze({id: "build_online", icon: "🔧", name: "BUILD ONLINE", description: "Schließe ein Level mit 3 aktiven Run-Perks ab.", secret: false, conditionKey: "complete-with-three-active-run-perks", category: "skill"}),
    Object.freeze({id: "double_tap", icon: "✌️", name: "DOUBLE TAP", description: "Schließe ein Level mit genau zwei Schüssen ab.", secret: false, conditionKey: "complete-with-two-shots", category: "skill"}),
    Object.freeze({id: "two_out_of_three", icon: "⚖️", name: "TWO OUT OF THREE", description: "Schließe ein Level mit genau zwei von drei Pflichtsternen ab.", secret: false, conditionKey: "complete-with-two-of-three-required-stars", category: "skill"}),
    Object.freeze({id: "bounce_marathon", icon: "🪀", name: "BOUNCE MARATHON", description: "Nutze 25 Bounce-Pads in Folge, ohne normal zu landen.", secret: false, conditionKey: "bounce-streak-25", category: "skill"}),
    Object.freeze({id: "flawless_20", icon: "🦾", name: "FLAWLESS 20", description: "Schaffe 20 Perfects direkt hintereinander.", secret: false, conditionKey: "perfect-streak-20", category: "endgame"}),
    Object.freeze({id: "clean_50", icon: "🧽", name: "CLEAN 50", description: "Schließe 50 Level hintereinander ohne Tod ab.", secret: false, conditionKey: "clean-level-streak-50", category: "endgame"}),
    Object.freeze({id: "run_200", icon: "♾️", name: "RUN 200", description: "Schließe 200 Level in einem einzigen Run ab.", secret: false, conditionKey: "run-completed-levels-200", category: "endgame"}),
    Object.freeze({id: "the_long_memory", icon: "🧓", name: "THE LONG MEMORY", description: "Schließe insgesamt 500 Level ab.", secret: false, conditionKey: "lifetime-completed-levels-500", category: "endgame"}),
    Object.freeze({id: "secret_achievement_404", icon: "🖥️", name: "ACHIEVEMENT 404", description: "Schließe Map-Level 404 ab. Achievement not found? Doch.", secret: true, conditionKey: "map-level-404-complete", category: "secret-endgame"}),
    Object.freeze({id: "secret_bare_minimum", icon: "🥚", name: "BARE MINIMUM", description: "Schließe ein Level ohne Tod, mit einem Leben und ohne Sterne ab.", secret: true, conditionKey: "zero-stars-one-life-no-death", category: "secret-situation"}),
    Object.freeze({id: "ein_richtiger_kevin", icon: "🐐", name: "EIN RICHTIGER KEVIN", description: "Schalte alle anderen 100 Achievements frei.", secret: true, conditionKey: "all-achievements-except-kevin", category: "completion"})
  ]);

  const NEW_BIOME_IDS = Object.freeze([
    "stormNight", "neonCity", "mushroomCave", "abandonedMine", "bambooNight",
    "pirateHarbor", "alienJungle", "enchantedGarden", "redMoon", "undergroundTemple"
  ]);
  const NIGHT_BIOME_IDS = Object.freeze([
    "night", "stormNight", "bambooNight", "redMoon"
  ]);
  const CAVE_BIOME_IDS = Object.freeze([
    "crystalCave", "mushroomCave", "abandonedMine", "undergroundTemple"
  ]);
  const LEVELS_PER_BIOME = 10;

  const ACHIEVEMENT_BY_ID = new Map(
    ACHIEVEMENT_REGISTRY.map(achievement => [achievement.id, achievement])
  );

  function safeParseStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function loadAchievementUnlocks() {
    const stored = safeParseStorage(ACHIEVEMENTS_STORAGE_KEY, []);
    if (!Array.isArray(stored)) return [];

    const validById = new Map();
    for (const entry of stored) {
      const id = String(entry?.id ?? "");
      const unlockedAt = Math.floor(Number(entry?.unlockedAt));
      if (!ACHIEVEMENT_BY_ID.has(id) || !Number.isFinite(unlockedAt) || unlockedAt <= 0) {
        continue;
      }
      const previous = validById.get(id);
      if (!previous || unlockedAt > previous.unlockedAt) {
        validById.set(id, {id, unlockedAt});
      }
    }
    return [...validById.values()];
  }

  function getExistingBiomeIds() {
    if (typeof BIOMES === "undefined" || !Array.isArray(BIOMES)) return [];
    return BIOMES.map(biome => String(biome.id));
  }

  function getNonNegativeInteger(value) {
    const numericValue = Math.floor(Number(value));
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
  }

  function getNonNegativeNumber(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
  }

  function getStoredBiomeIds(value, existingBiomeIds) {
    if (!Array.isArray(value)) return [];
    return [...new Set(
      value
        .map(id => String(id))
        .filter(id => existingBiomeIds.has(id))
    )];
  }

  function isRegisteredLookKey(value) {
    if (
      typeof SLIME_COLOR_ORDER === "undefined" ||
      typeof SLIME_COSMETIC_ORDER === "undefined" ||
      typeof SLIME_BEARD_ORDER === "undefined"
    ) {
      return false;
    }
    const parts = String(value).split("|");
    return parts.length === 3 &&
      SLIME_COLOR_ORDER.includes(parts[0]) &&
      SLIME_COSMETIC_ORDER.includes(parts[1]) &&
      SLIME_BEARD_ORDER.includes(parts[2]);
  }

  function loadAchievementProgress() {
    const stored = safeParseStorage(ACHIEVEMENT_PROGRESS_STORAGE_KEY, {});
    const existingBiomeIds = new Set(getExistingBiomeIds());
    const completedLookIds = Array.isArray(stored?.completedLookIds)
      ? [...new Set(
          stored.completedLookIds
            .map(lookId => String(lookId))
            .filter(isRegisteredLookKey)
        )]
      : [];
    return {
      discoveredBiomeIds: getStoredBiomeIds(stored?.discoveredBiomeIds, existingBiomeIds),
      perfectBiomeIds: getStoredBiomeIds(stored?.perfectBiomeIds, existingBiomeIds),
      deathFreeBiomeIds: getStoredBiomeIds(stored?.deathFreeBiomeIds, existingBiomeIds),
      completedLookIds,
      lifetimeStars: getNonNegativeInteger(stored?.lifetimeStars),
      lifetimeAirTime: getNonNegativeNumber(stored?.lifetimeAirTime),
      lifetimeCompletedLevels: getNonNegativeInteger(stored?.lifetimeCompletedLevels),
      lifetimeDeaths: getNonNegativeInteger(stored?.lifetimeDeaths),
      lifetimePerfects: getNonNegativeInteger(stored?.lifetimePerfects)
    };
  }

  let unlockedAchievements = loadAchievementUnlocks();
  const unlockedById = new Map(
    unlockedAchievements.map(unlock => [unlock.id, unlock])
  );
  let selectedAchievementBadges = loadSelectedAchievementBadges();
  let callingCardBadgesConfigured = loadCallingCardBadgesConfigured(
    selectedAchievementBadges
  );
  let devCallingCardPreview = null;
  let lastUnlockTimestamp = unlockedAchievements.reduce(
    (latest, unlock) => Math.max(latest, unlock.unlockedAt),
    0
  );
  const achievementProgress = loadAchievementProgress();
  let starBalance = loadStarBalance();
  let starAwardReceipts = loadStarAwardReceipts();
  const popupQueue = [];
  const recentDeathTimestamps = [];
  const activeWardrobePurchases = new Set();
  const devShopTestUnlocks = new Set();
  let devShopTestActive = false;
  let devShopTestBalance = DEV_SHOP_TEST_INITIAL_BALANCE;
  let popupActive = false;
  let activePopupAchievement = null;
  let achievementPopupsPaused = false;
  let popupGeneration = 0;
  let runProgressSnapshot = null;
  let completionCheckInProgress = false;

  const runState = {
    perfectStreak: 0,
    cleanLevelStreak: 0,
    completedLevels: 0,
    ghostCleanLevels: 0,
    speedLevels: 0,
    perfectClearLevels: 0,
    runStars: 0,
    runBiomeIds: new Set(),
    rotationComplete: false,
    previousBiomeId: null,
    previousLevelNumber: 0,
    levelNumber: 1,
    biomeId: null,
    levelElapsed: 0,
    levelHadDeath: false,
    levelHasGhost: false,
    ghostHit: false,
    bounceStreak: 0,
    levelShots: 0,
    shotActive: false,
    starsSinceShot: 0,
    airTime: 0,
    lifetimeAirTimePending: 0,
    rescueUsed: false,
    groundhogLevelNumber: null,
    groundhogDeaths: 0
  };

  function saveAchievementUnlocks() {
    try {
      localStorage.setItem(
        ACHIEVEMENTS_STORAGE_KEY,
        JSON.stringify(unlockedAchievements)
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveAchievementProgress({writeVersion = true} = {}) {
    try {
      localStorage.setItem(
        ACHIEVEMENT_PROGRESS_STORAGE_KEY,
        JSON.stringify(achievementProgress)
      );
      if (writeVersion) {
        localStorage.setItem(
          ACHIEVEMENT_PROGRESS_VERSION_STORAGE_KEY,
          ACHIEVEMENT_PROGRESS_VERSION
        );
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadStarBalance() {
    let balance = 0;
    try {
      const storedBalance = localStorage.getItem(STAR_BALANCE_STORAGE_KEY);
      const economyWasInitialized =
        localStorage.getItem(STAR_ECONOMY_VERSION_STORAGE_KEY) ===
        STAR_ECONOMY_VERSION;
      if (storedBalance !== null) {
        balance = getNonNegativeInteger(storedBalance);
      } else if (!economyWasInitialized) {
        const storedProgress = safeParseStorage(ACHIEVEMENT_PROGRESS_STORAGE_KEY, {});
        const hasReliableLifetimeStars =
          storedProgress &&
          typeof storedProgress === "object" &&
          Object.prototype.hasOwnProperty.call(storedProgress, "lifetimeStars");
        if (hasReliableLifetimeStars) {
          balance = getNonNegativeInteger(storedProgress.lifetimeStars);
        }
      }
      localStorage.setItem(STAR_BALANCE_STORAGE_KEY, String(balance));
      localStorage.setItem(
        STAR_ECONOMY_VERSION_STORAGE_KEY,
        STAR_ECONOMY_VERSION
      );
    } catch (_) {}
    return balance;
  }

  function saveStarBalance() {
    try {
      localStorage.setItem(STAR_BALANCE_STORAGE_KEY, String(starBalance));
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveStarBalanceVerified() {
    if (!saveStarBalance()) return false;
    try {
      return localStorage.getItem(STAR_BALANCE_STORAGE_KEY) === String(starBalance);
    } catch (_) {
      return false;
    }
  }

  function normalizeStarAwardTransactionId(value) {
    const transactionId = String(value ?? "");
    return transactionId.length > 0 && transactionId.length <= 160 &&
      /^[a-zA-Z0-9:._-]+$/.test(transactionId)
      ? transactionId
      : null;
  }

  function createDefaultStarAwardReceipts() {
    return {version: STAR_AWARD_RECEIPTS_VERSION, totalAwarded: 0, receipts: {}};
  }

  function normalizeStarAwardReceipts(value) {
    const normalized = createDefaultStarAwardReceipts();
    if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;
    const sourceReceipts = value.receipts && typeof value.receipts === "object" &&
      !Array.isArray(value.receipts)
      ? value.receipts
      : {};
    let appliedTotal = 0;
    for (const [rawTransactionId, rawReceipt] of Object.entries(sourceReceipts)) {
      const transactionId = normalizeStarAwardTransactionId(rawTransactionId);
      const amount = Math.floor(Number(rawReceipt?.amount));
      const beforeBalance = Math.floor(Number(rawReceipt?.beforeBalance));
      const beforeLifetimeStars = Math.floor(Number(rawReceipt?.beforeLifetimeStars));
      const status = rawReceipt?.status === "applied" ? "applied" : "pending";
      if (
        !transactionId ||
        !Number.isSafeInteger(amount) || amount <= 0 ||
        !Number.isSafeInteger(beforeBalance) || beforeBalance < 0 ||
        !Number.isSafeInteger(beforeLifetimeStars) || beforeLifetimeStars < 0 ||
        rawReceipt?.source !== "checkpoint_bonus"
      ) {
        continue;
      }
      normalized.receipts[transactionId] = {
        amount,
        source: "checkpoint_bonus",
        beforeBalance,
        beforeLifetimeStars,
        status
      };
      if (status === "applied") appliedTotal += amount;
    }
    normalized.totalAwarded = appliedTotal;
    return normalized;
  }

  function loadStarAwardReceipts() {
    try {
      return normalizeStarAwardReceipts(JSON.parse(
        localStorage.getItem(STAR_AWARD_RECEIPTS_STORAGE_KEY) || "null"
      ));
    } catch (_) {
      return createDefaultStarAwardReceipts();
    }
  }

  function saveStarAwardReceiptsVerified(nextReceipts = starAwardReceipts) {
    const normalized = normalizeStarAwardReceipts(nextReceipts);
    const serialized = JSON.stringify(normalized);
    try {
      localStorage.setItem(STAR_AWARD_RECEIPTS_STORAGE_KEY, serialized);
      if (localStorage.getItem(STAR_AWARD_RECEIPTS_STORAGE_KEY) !== serialized) {
        return false;
      }
    } catch (_) {
      return false;
    }
    starAwardReceipts = normalized;
    return true;
  }

  function notifyStarEconomyChange() {
    try {
      if (typeof renderMainMenuStats === "function") renderMainMenuStats();
      if (typeof window.CustomEvent === "function") {
        window.dispatchEvent(new window.CustomEvent("slimestareconomychange"));
      }
    } catch (_) {}
  }

  function awardStars(amount, {transactionId, source} = {}) {
    const normalizedAmount = Math.floor(Number(amount));
    const normalizedTransactionId = normalizeStarAwardTransactionId(transactionId);
    if (
      !Number.isSafeInteger(normalizedAmount) || normalizedAmount <= 0 ||
      !normalizedTransactionId || source !== "checkpoint_bonus"
    ) {
      return {ok: false, reason: "invalid-award", balance: starBalance};
    }

    let receipt = starAwardReceipts.receipts[normalizedTransactionId] ?? null;
    if (receipt && (receipt.amount !== normalizedAmount || receipt.source !== source)) {
      return {ok: false, reason: "transaction-conflict", balance: starBalance};
    }
    if (receipt?.status === "applied") {
      return {
        ok: true,
        duplicate: true,
        transactionId: normalizedTransactionId,
        amount: normalizedAmount,
        balance: starBalance,
        lifetimeStars: achievementProgress.lifetimeStars
      };
    }

    if (!receipt) {
      receipt = {
        amount: normalizedAmount,
        source: "checkpoint_bonus",
        beforeBalance: starBalance,
        beforeLifetimeStars: achievementProgress.lifetimeStars,
        status: "pending"
      };
      const nextReceipts = normalizeStarAwardReceipts(starAwardReceipts);
      nextReceipts.receipts[normalizedTransactionId] = receipt;
      if (!saveStarAwardReceiptsVerified(nextReceipts)) {
        return {ok: false, reason: "receipt-storage-error", balance: starBalance};
      }
    }

    const targetBalance = receipt.beforeBalance + normalizedAmount;
    const targetLifetimeStars = receipt.beforeLifetimeStars + normalizedAmount;
    starBalance = Math.max(starBalance, targetBalance);
    achievementProgress.lifetimeStars = Math.max(
      achievementProgress.lifetimeStars,
      targetLifetimeStars
    );
    if (!saveAchievementProgress() || !saveStarBalanceVerified()) {
      return {ok: false, reason: "award-storage-error", balance: starBalance};
    }

    if (achievementProgress.lifetimeStars >= 1000) unlockAchievement("star_bank");
    const appliedReceipts = normalizeStarAwardReceipts(starAwardReceipts);
    appliedReceipts.receipts[normalizedTransactionId] = {...receipt, status: "applied"};
    if (!saveStarAwardReceiptsVerified(appliedReceipts)) {
      return {ok: false, reason: "receipt-finalize-error", balance: starBalance};
    }

    notifyStarEconomyChange();
    return {
      ok: true,
      duplicate: false,
      transactionId: normalizedTransactionId,
      amount: normalizedAmount,
      balance: starBalance,
      lifetimeStars: achievementProgress.lifetimeStars
    };
  }

  function applyPerkMigrationBalance(targetBalance) {
    const normalizedTarget = Math.floor(Number(targetBalance));
    if (!Number.isSafeInteger(normalizedTarget) || normalizedTarget < 0) return false;

    const previousBalance = starBalance;
    starBalance = normalizedTarget;
    if (saveStarBalanceVerified()) return true;

    starBalance = previousBalance;
    saveStarBalance();
    return false;
  }

  function cloneAchievementProgress() {
    return {
      discoveredBiomeIds: achievementProgress.discoveredBiomeIds.slice(),
      perfectBiomeIds: achievementProgress.perfectBiomeIds.slice(),
      deathFreeBiomeIds: achievementProgress.deathFreeBiomeIds.slice(),
      completedLookIds: achievementProgress.completedLookIds.slice(),
      lifetimeStars: achievementProgress.lifetimeStars,
      lifetimeAirTime: achievementProgress.lifetimeAirTime,
      lifetimeCompletedLevels: achievementProgress.lifetimeCompletedLevels,
      lifetimeDeaths: achievementProgress.lifetimeDeaths,
      lifetimePerfects: achievementProgress.lifetimePerfects
    };
  }

  function cloneRunState() {
    return {
      ...runState,
      runBiomeIds: [...runState.runBiomeIds]
    };
  }

  function isNonNegativeIntegerSnapshotValue(value) {
    return Number.isInteger(value) && value >= 0;
  }

  function isNonNegativeNumberSnapshotValue(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function normalizeUniqueStringSnapshotValues(values, isValidValue) {
    if (!Array.isArray(values)) return null;
    const normalized = [];
    for (const value of values) {
      if (typeof value !== "string" || !isValidValue(value) || normalized.includes(value)) {
        return null;
      }
      normalized.push(value);
    }
    return normalized;
  }

  function normalizeAchievementProgressSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const existingBiomeIds = new Set(getExistingBiomeIds());
    const isExistingBiomeId = id => existingBiomeIds.has(id);
    const discoveredBiomeIds = normalizeUniqueStringSnapshotValues(
      value.discoveredBiomeIds,
      isExistingBiomeId
    );
    const perfectBiomeIds = normalizeUniqueStringSnapshotValues(
      value.perfectBiomeIds,
      isExistingBiomeId
    );
    const deathFreeBiomeIds = normalizeUniqueStringSnapshotValues(
      value.deathFreeBiomeIds,
      isExistingBiomeId
    );
    const completedLookIds = normalizeUniqueStringSnapshotValues(
      value.completedLookIds,
      isRegisteredLookKey
    );
    if (
      !discoveredBiomeIds ||
      !perfectBiomeIds ||
      !deathFreeBiomeIds ||
      !completedLookIds ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimeStars) ||
      !isNonNegativeNumberSnapshotValue(value.lifetimeAirTime) ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimeCompletedLevels) ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimeDeaths) ||
      !isNonNegativeIntegerSnapshotValue(value.lifetimePerfects)
    ) {
      return null;
    }
    return {
      discoveredBiomeIds,
      perfectBiomeIds,
      deathFreeBiomeIds,
      completedLookIds,
      lifetimeStars: value.lifetimeStars,
      lifetimeAirTime: value.lifetimeAirTime,
      lifetimeCompletedLevels: value.lifetimeCompletedLevels,
      lifetimeDeaths: value.lifetimeDeaths,
      lifetimePerfects: value.lifetimePerfects
    };
  }

  function normalizeAchievementRunStateSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const existingBiomeIds = new Set(getExistingBiomeIds());
    const runBiomeIds = normalizeUniqueStringSnapshotValues(
      value.runBiomeIds,
      id => existingBiomeIds.has(id)
    );
    const integerFields = [
      "perfectStreak",
      "cleanLevelStreak",
      "completedLevels",
      "ghostCleanLevels",
      "speedLevels",
      "perfectClearLevels",
      "runStars",
      "previousLevelNumber",
      "bounceStreak",
      "levelShots",
      "starsSinceShot",
      "groundhogDeaths"
    ];
    const numberFields = [
      "levelElapsed",
      "airTime",
      "lifetimeAirTimePending"
    ];
    const booleanFields = [
      "rotationComplete",
      "levelHadDeath",
      "levelHasGhost",
      "ghostHit",
      "shotActive",
      "rescueUsed"
    ];
    const biomeFieldsAreValid = [value.previousBiomeId, value.biomeId].every(
      id => id === null || (typeof id === "string" && existingBiomeIds.has(id))
    );
    if (
      !runBiomeIds ||
      integerFields.some(field => !isNonNegativeIntegerSnapshotValue(value[field])) ||
      numberFields.some(field => !isNonNegativeNumberSnapshotValue(value[field])) ||
      booleanFields.some(field => typeof value[field] !== "boolean") ||
      !Number.isInteger(value.levelNumber) ||
      value.levelNumber < 1 ||
      !biomeFieldsAreValid ||
      (
        value.groundhogLevelNumber !== null &&
        (!Number.isInteger(value.groundhogLevelNumber) || value.groundhogLevelNumber < 1)
      )
    ) {
      return null;
    }
    return {
      perfectStreak: value.perfectStreak,
      cleanLevelStreak: value.cleanLevelStreak,
      completedLevels: value.completedLevels,
      ghostCleanLevels: value.ghostCleanLevels,
      speedLevels: value.speedLevels,
      perfectClearLevels: value.perfectClearLevels,
      runStars: value.runStars,
      runBiomeIds,
      rotationComplete: value.rotationComplete,
      previousBiomeId: value.previousBiomeId,
      previousLevelNumber: value.previousLevelNumber,
      levelNumber: value.levelNumber,
      biomeId: value.biomeId,
      levelElapsed: value.levelElapsed,
      levelHadDeath: value.levelHadDeath,
      levelHasGhost: value.levelHasGhost,
      ghostHit: value.ghostHit,
      bounceStreak: value.bounceStreak,
      levelShots: value.levelShots,
      shotActive: value.shotActive,
      starsSinceShot: value.starsSinceShot,
      airTime: value.airTime,
      lifetimeAirTimePending: value.lifetimeAirTimePending,
      rescueUsed: value.rescueUsed,
      groundhogLevelNumber: value.groundhogLevelNumber,
      groundhogDeaths: value.groundhogDeaths
    };
  }

  function normalizeRunProgressSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!Array.isArray(value.unlockedAchievements)) return null;

    const normalizedUnlocks = [];
    const unlockIds = new Set();
    for (const unlock of value.unlockedAchievements) {
      if (
        !unlock ||
        typeof unlock !== "object" ||
        Array.isArray(unlock) ||
        typeof unlock.id !== "string" ||
        !ACHIEVEMENT_BY_ID.has(unlock.id) ||
        unlockIds.has(unlock.id) ||
        !Number.isInteger(unlock.unlockedAt) ||
        unlock.unlockedAt <= 0
      ) {
        return null;
      }
      unlockIds.add(unlock.id);
      normalizedUnlocks.push({id: unlock.id, unlockedAt: unlock.unlockedAt});
    }

    const normalizedProgress = normalizeAchievementProgressSnapshot(
      value.achievementProgress
    );
    const normalizedRunState = normalizeAchievementRunStateSnapshot(value.runState);
    const recentDeathTimestamps = Array.isArray(value.recentDeathTimestamps) &&
      value.recentDeathTimestamps.every(isNonNegativeNumberSnapshotValue)
      ? value.recentDeathTimestamps.slice()
      : null;
    const popupQueueIds = normalizeUniqueStringSnapshotValues(
      value.popupQueueIds,
      id => ACHIEVEMENT_BY_ID.has(id)
    );
    const latestUnlockTimestamp = normalizedUnlocks.reduce(
      (latest, unlock) => Math.max(latest, unlock.unlockedAt),
      0
    );
    const starAwardTotal = value.starAwardTotal === undefined
      ? 0
      : value.starAwardTotal;
    if (
      !normalizedProgress ||
      !normalizedRunState ||
      !recentDeathTimestamps ||
      !popupQueueIds ||
      !isNonNegativeIntegerSnapshotValue(value.starBalance) ||
      !isNonNegativeIntegerSnapshotValue(starAwardTotal) ||
      !isNonNegativeIntegerSnapshotValue(value.lastUnlockTimestamp) ||
      value.lastUnlockTimestamp < latestUnlockTimestamp
    ) {
      return null;
    }
    return {
      unlockedAchievements: normalizedUnlocks,
      achievementProgress: normalizedProgress,
      starBalance: value.starBalance,
      starAwardTotal,
      lastUnlockTimestamp: value.lastUnlockTimestamp,
      runState: normalizedRunState,
      recentDeathTimestamps,
      popupQueueIds
    };
  }

  function isRunProgressSnapshotValid(value) {
    return normalizeRunProgressSnapshot(value) !== null;
  }

  function captureRunProgressSnapshot() {
    runProgressSnapshot = {
      unlockedAchievements: unlockedAchievements.map(unlock => ({...unlock})),
      achievementProgress: cloneAchievementProgress(),
      starBalance,
      starAwardTotal: starAwardReceipts.totalAwarded,
      lastUnlockTimestamp,
      runState: cloneRunState(),
      recentDeathTimestamps: recentDeathTimestamps.slice(),
      popupQueueIds: popupQueue.map(achievement => achievement.id)
    };
    return normalizeRunProgressSnapshot(runProgressSnapshot);
  }

  function restoreRunProgressSnapshot(snapshot = runProgressSnapshot) {
    const normalizedSnapshot = normalizeRunProgressSnapshot(snapshot);
    if (!normalizedSnapshot) return false;

    unlockedAchievements = normalizedSnapshot.unlockedAchievements.map(
      unlock => ({...unlock})
    );
    unlockedById.clear();
    unlockedAchievements.forEach(unlock => unlockedById.set(unlock.id, unlock));
    lastUnlockTimestamp = normalizedSnapshot.lastUnlockTimestamp;

    const durableStarDelta = Math.max(
      0,
      starAwardReceipts.totalAwarded - normalizedSnapshot.starAwardTotal
    );
    normalizedSnapshot.achievementProgress.lifetimeStars += durableStarDelta;
    normalizedSnapshot.starBalance += durableStarDelta;

    Object.assign(
      achievementProgress,
      normalizedSnapshot.achievementProgress,
      {
        discoveredBiomeIds:
          normalizedSnapshot.achievementProgress.discoveredBiomeIds.slice(),
        perfectBiomeIds:
          normalizedSnapshot.achievementProgress.perfectBiomeIds.slice(),
        deathFreeBiomeIds:
          normalizedSnapshot.achievementProgress.deathFreeBiomeIds.slice(),
        completedLookIds:
          normalizedSnapshot.achievementProgress.completedLookIds.slice()
      }
    );
    starBalance = normalizedSnapshot.starBalance;

    Object.assign(runState, normalizedSnapshot.runState, {
      runBiomeIds: new Set(normalizedSnapshot.runState.runBiomeIds)
    });
    recentDeathTimestamps.splice(
      0,
      recentDeathTimestamps.length,
      ...normalizedSnapshot.recentDeathTimestamps
    );

    popupGeneration++;
    popupActive = false;
    popupQueue.splice(
      0,
      popupQueue.length,
      ...normalizedSnapshot.popupQueueIds
        .map(id => ACHIEVEMENT_BY_ID.get(id))
        .filter(Boolean)
    );
    if (typeof document !== "undefined") {
      document.getElementById("achievementPopup")?.classList.remove("visible");
    }

    const unlocksSaved = saveAchievementUnlocks();
    const progressSaved = saveAchievementProgress({writeVersion: false});
    const balanceSaved = saveStarBalance();
    if (achievementProgress.lifetimeStars >= 1000) unlockAchievement("star_bank");
    renderAchievementViews();
    showNextAchievementPopup();
    return unlocksSaved && progressSaved && balanceSaved;
  }

  function discardRunProgressSnapshot() {
    runProgressSnapshot = null;
  }

  function formatUnlockDate(unlockedAt) {
    try {
      return new Date(unlockedAt).toLocaleDateString("de-DE");
    } catch (_) {
      return "";
    }
  }

  function getRecentAchievements(limit = 5) {
    return unlockedAchievements
      .slice()
      .sort((a, b) => b.unlockedAt - a.unlockedAt)
      .slice(0, Math.max(0, Math.floor(limit)))
      .map(unlock => ({
        ...ACHIEVEMENT_BY_ID.get(unlock.id),
        unlockedAt: unlock.unlockedAt
      }));
  }

  function normalizeSelectedAchievementBadgeIds(value) {
    if (!Array.isArray(value)) return [];

    const normalized = [];
    value.forEach(id => {
      if (normalized.length >= CALLING_CARD_BADGE_LIMIT || typeof id !== "string") {
        return;
      }
      const cleanId = id.trim();
      if (
        !cleanId ||
        !ACHIEVEMENT_BY_ID.has(cleanId) ||
        !unlockedById.has(cleanId) ||
        normalized.includes(cleanId)
      ) {
        return;
      }
      normalized.push(cleanId);
    });
    return normalized;
  }

  function loadSelectedAchievementBadges() {
    return normalizeSelectedAchievementBadgeIds(
      safeParseStorage(SELECTED_ACHIEVEMENT_BADGES_STORAGE_KEY, [])
    );
  }

  function loadCallingCardBadgesConfigured(selectedBadgeIds) {
    try {
      const storedValue = localStorage.getItem(
        CALLING_CARD_BADGES_CONFIGURED_STORAGE_KEY
      );
      if (storedValue !== null) return storedValue === "true";
      return Array.isArray(selectedBadgeIds) && selectedBadgeIds.length > 0;
    } catch (_) {
      return false;
    }
  }

  function saveSelectedAchievementBadges() {
    try {
      localStorage.setItem(
        SELECTED_ACHIEVEMENT_BADGES_STORAGE_KEY,
        JSON.stringify(selectedAchievementBadges)
      );
    } catch (_) {}
  }

  function saveCallingCardBadgesConfigured() {
    try {
      localStorage.setItem(
        CALLING_CARD_BADGES_CONFIGURED_STORAGE_KEY,
        String(callingCardBadgesConfigured)
      );
    } catch (_) {}
  }

  function getSelectedAchievementBadgeIds() {
    return selectedAchievementBadges.slice(0, CALLING_CARD_BADGE_LIMIT);
  }

  function getEffectiveCallingCardBadgeIds() {
    if (callingCardBadgesConfigured) {
      return getSelectedAchievementBadgeIds();
    }
    return getRecentAchievements(CALLING_CARD_BADGE_LIMIT)
      .map(achievement => achievement.id);
  }

  function getCallingCardDisplayIds() {
    if (isDevModeEnabled() && devCallingCardPreview !== null) {
      return devCallingCardPreview.slice(0, CALLING_CARD_BADGE_LIMIT);
    }
    return getEffectiveCallingCardBadgeIds();
  }

  function toggleCallingCardAchievement(id) {
    const achievementId = String(id ?? "");
    if (!ACHIEVEMENT_BY_ID.has(achievementId)) return false;

    const actuallyUnlocked = unlockedById.has(achievementId);
    const devPreviewAllowed = isDevModeEnabled() && !actuallyUnlocked;
    if (!actuallyUnlocked && !devPreviewAllowed) return false;

    if (devPreviewAllowed && devCallingCardPreview === null) {
      devCallingCardPreview = getEffectiveCallingCardBadgeIds();
    }

    const displaySelection = getCallingCardDisplayIds();
    const selectedIndex = displaySelection.indexOf(achievementId);
    if (selectedIndex < 0 && displaySelection.length >= CALLING_CARD_BADGE_LIMIT) {
      return false;
    }

    if (selectedIndex >= 0) {
      displaySelection.splice(selectedIndex, 1);
    } else {
      displaySelection.push(achievementId);
    }

    if (actuallyUnlocked) {
      selectedAchievementBadges = normalizeSelectedAchievementBadgeIds(displaySelection);
      callingCardBadgesConfigured = true;
      saveSelectedAchievementBadges();
      saveCallingCardBadgesConfigured();
    }

    if (isDevModeEnabled() && devCallingCardPreview !== null) {
      devCallingCardPreview = displaySelection;
    }

    renderAchievementViews();
    return true;
  }

  function renderRecentAchievements() {
    if (typeof document === "undefined") return;
    const list = document.getElementById("recentAchievementList");
    if (!list) return;
    const title = document.getElementById("recentAchievementsTitle");
    const recentPanel = document.getElementById("recentAchievements");
    const selectedPrestigeFrame = window.SlimePrestige?.getSelectedReward?.("frame") ?? "none";
    const selectedPrestigeTitle = window.SlimePrestige?.getSelectedReward?.("title") ?? "none";
    const prestigeTitleDefinition = window.SlimePrestige?.getRewardDefinition?.(
      "title",
      selectedPrestigeTitle
    );
    if (recentPanel) recentPanel.dataset.prestigeFrame = selectedPrestigeFrame;
    const callingCardIds = getCallingCardDisplayIds();
    const achievements = callingCardIds
      .map(id => ACHIEVEMENT_BY_ID.get(id))
      .filter(Boolean)
      .slice(0, CALLING_CARD_BADGE_LIMIT);
    const hasManualCallingCardDisplay = callingCardBadgesConfigured ||
      (isDevModeEnabled() && devCallingCardPreview !== null);
    if (title) {
      title.textContent = prestigeTitleDefinition
        ? prestigeTitleDefinition.displayName
        : hasManualCallingCardDisplay
          ? "Calling Card"
          : "Letzte Erfolge";
    }
    list.replaceChildren();

    if (achievements.length === 0) {
      const empty = document.createElement("span");
      empty.className = "recentAchievementEmpty";
      empty.textContent = hasManualCallingCardDisplay
        ? "Keine Badges ausgewählt"
        : "Noch keine Erfolge";
      list.appendChild(empty);
      return;
    }

    for (const achievement of achievements) {
      const item = document.createElement("span");
      item.className = "recentAchievementItem";
      item.setAttribute("aria-label", achievement.name);
      const icon = document.createElement("span");
      icon.className = "recentAchievementIcon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = achievement.icon;
      item.appendChild(icon);
      list.appendChild(item);
    }
  }

  function renderCallingCardPreview() {
    if (typeof document === "undefined") return;
    const preview = document.getElementById("achievementCallingCardSlots");
    if (!preview) return;
    const previewPanel = preview.closest(".achievementCallingCardPreview");
    const selectedPrestigeFrame = window.SlimePrestige?.getSelectedReward?.("frame") ?? "none";
    if (previewPanel) previewPanel.dataset.prestigeFrame = selectedPrestigeFrame;
    const title = document.getElementById("achievementPrestigeTitle");
    const selectedPrestigeTitle = window.SlimePrestige?.getSelectedReward?.("title") ?? "none";
    const titleDefinition = window.SlimePrestige?.getRewardDefinition?.(
      "title",
      selectedPrestigeTitle
    );
    if (title) {
      title.textContent = titleDefinition?.displayName ?? "";
      title.classList.toggle("hidden", !titleDefinition);
    }

    const selectedIds = getCallingCardDisplayIds();
    preview.replaceChildren();

    for (let index = 0; index < CALLING_CARD_BADGE_LIMIT; index++) {
      const achievement = ACHIEVEMENT_BY_ID.get(selectedIds[index]);
      const slot = document.createElement("span");
      slot.className = "achievementCallingCardPreviewSlot";
      slot.classList.toggle("filled", Boolean(achievement));
      slot.setAttribute(
        "aria-label",
        achievement
          ? `Slot ${index + 1}: ${achievement.name}`
          : `Slot ${index + 1}: nicht belegt`
      );
      slot.textContent = achievement ? achievement.icon : String(index + 1);
      preview.appendChild(slot);
    }
  }

  function renderAchievementMenu() {
    if (typeof document === "undefined") return;
    const grid = document.getElementById("achievementGrid");
    const progressText = document.getElementById("achievementProgressText");
    if (!grid || !progressText) return;

    const previousScrollTop = grid.scrollTop;
    const devPreview = typeof DEV_MODE !== "undefined" && DEV_MODE;
    const callingCardIds = getCallingCardDisplayIds();
    const visibleUnlockCount = devPreview
      ? ACHIEVEMENT_REGISTRY.length
      : unlockedAchievements.length;
    progressText.textContent =
      `${visibleUnlockCount} / ${ACHIEVEMENT_REGISTRY.length} freigeschaltet`;
    renderCallingCardPreview();
    grid.replaceChildren();

    for (const achievement of ACHIEVEMENT_REGISTRY) {
      const unlock = unlockedById.get(achievement.id);
      const isActuallyUnlocked = Boolean(unlock);
      const isVisuallyUnlocked = isActuallyUnlocked || devPreview;
      const hidesSecret = achievement.secret && !isVisuallyUnlocked;
      const callingCardSlot = callingCardIds.indexOf(achievement.id);
      const isCallingCardSelected = callingCardSlot >= 0;
      const card = document.createElement("article");
      card.className = "achievementCard";
      card.classList.toggle("unlocked", isVisuallyUnlocked);
      card.classList.toggle("locked", !isVisuallyUnlocked);
      card.classList.toggle("secret", hidesSecret);
      card.classList.toggle("callingCardSelected", isCallingCardSelected);
      card.setAttribute(
        "aria-label",
        hidesSecret
          ? "Geheimes Achievement gesperrt"
          : `${achievement.name}: ${achievement.description}${
              isCallingCardSelected
                ? `, Calling Card Slot ${callingCardSlot + 1}`
                : ", für Calling Card auswählen"
            }`
      );

      const icon = document.createElement("span");
      icon.className = "achievementCardIcon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = hidesSecret ? "?" : achievement.icon;

      const content = document.createElement("div");
      content.className = "achievementCardContent";
      const name = document.createElement("h3");
      name.textContent = hidesSecret ? "???" : achievement.name;
      const description = document.createElement("p");
      description.textContent = hidesSecret ? "???" : achievement.description;
      const status = document.createElement("span");
      status.className = "achievementCardStatus";
      status.textContent = isActuallyUnlocked
        ? `Freigeschaltet · ${formatUnlockDate(unlock.unlockedAt)}`
        : devPreview
          ? "DEV-Vorschau"
          : "Gesperrt";
      if (isCallingCardSelected) {
        status.textContent =
          `${isActuallyUnlocked ? "Calling Card" : "DEV-Calling Card"} · ` +
          `Slot ${callingCardSlot + 1}`;
      }
      content.append(name, description, status);
      card.append(icon, content);

      if (isCallingCardSelected) {
        const slotBadge = document.createElement("span");
        slotBadge.className = "achievementCallingCardSlotBadge";
        slotBadge.setAttribute("aria-hidden", "true");
        slotBadge.textContent = String(callingCardSlot + 1);
        card.appendChild(slotBadge);
      }

      if (isVisuallyUnlocked) {
        card.setAttribute("role", "button");
        card.setAttribute("aria-pressed", String(isCallingCardSelected));
        card.tabIndex = 0;
        card.addEventListener("click", () => {
          toggleCallingCardAchievement(achievement.id);
        });
        card.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggleCallingCardAchievement(achievement.id);
        });
      }
      grid.appendChild(card);
    }
    grid.scrollTop = previousScrollTop;
  }

  function renderAchievementViews() {
    renderAchievementMenu();
    renderRecentAchievements();
  }

  function showNextAchievementPopup() {
    if (
      achievementPopupsPaused || popupActive || popupQueue.length === 0 ||
      typeof document === "undefined"
    ) return;
    const popup = document.getElementById("achievementPopup");
    const icon = document.getElementById("achievementPopupIcon");
    const name = document.getElementById("achievementPopupName");
    if (!popup || !icon || !name) return;

    const achievement = popupQueue.shift();
    const generation = popupGeneration;
    popupActive = true;
    activePopupAchievement = achievement;
    icon.textContent = achievement.icon;
    name.textContent = achievement.name;
    popup.classList.remove("visible");
    void popup.offsetWidth;
    popup.classList.add("visible");

    window.setTimeout(() => {
      if (generation !== popupGeneration) return;
      popup.classList.remove("visible");
      window.setTimeout(() => {
        if (generation !== popupGeneration) return;
        popupActive = false;
        activePopupAchievement = null;
        showNextAchievementPopup();
      }, 260);
    }, 2400);
  }

  function setAchievementPopupsPaused(paused) {
    const nextPaused = Boolean(paused);
    if (achievementPopupsPaused === nextPaused) return;
    achievementPopupsPaused = nextPaused;
    if (nextPaused && popupActive) {
      popupGeneration++;
      if (activePopupAchievement) popupQueue.unshift(activePopupAchievement);
      activePopupAchievement = null;
      popupActive = false;
      document.getElementById("achievementPopup")?.classList.remove("visible");
      return;
    }
    if (!nextPaused) showNextAchievementPopup();
  }

  function queueAchievementPopup(achievement) {
    popupQueue.push(achievement);
    showNextAchievementPopup();
  }

  function unlockAchievement(id) {
    const achievement = ACHIEVEMENT_BY_ID.get(String(id));
    if (!achievement || unlockedById.has(achievement.id)) return false;

    const unlockedAt = Math.max(Date.now(), lastUnlockTimestamp + 1);
    lastUnlockTimestamp = unlockedAt;
    const unlock = {id: achievement.id, unlockedAt};
    unlockedAchievements.push(unlock);
    unlockedById.set(achievement.id, unlock);
    saveAchievementUnlocks();
    renderAchievementViews();
    queueAchievementPopup(achievement);
    if (!completionCheckInProgress) checkCompletionAchievements();
    return true;
  }

  function checkCompletionAchievements() {
    if (completionCheckInProgress) return;
    completionCheckInProgress = true;
    try {
      for (let pass = 0; pass < 3; pass++) {
        let unlockedInPass = false;
        const hunterReady = ACHIEVEMENT_REGISTRY
          .filter(achievement =>
            achievement.id !== "achievement_hunter" &&
            achievement.id !== "ein_richtiger_kevin"
          )
          .every(achievement => unlockedById.has(achievement.id));
        if (!unlockedById.has("achievement_hunter") && hunterReady) {
          unlockedInPass = unlockAchievement("achievement_hunter") || unlockedInPass;
        }

        const kevinReady = ACHIEVEMENT_REGISTRY
          .filter(achievement => achievement.id !== "ein_richtiger_kevin")
          .every(achievement => unlockedById.has(achievement.id));
        if (!unlockedById.has("ein_richtiger_kevin") && kevinReady) {
          unlockedInPass = unlockAchievement("ein_richtiger_kevin") || unlockedInPass;
        }
        if (!unlockedInPass) break;
      }
    } finally {
      completionCheckInProgress = false;
    }
  }

  function checkAchievementHunter() {
    checkCompletionAchievements();
  }

  function checkPerfectAchievements() {
    if (runState.perfectStreak >= 3) unlockAchievement("hp_gen");
    if (runState.perfectStreak >= 5) unlockAchievement("perfectionist");
    if (runState.perfectStreak >= 10) unlockAchievement("untouchable");
    if (runState.perfectStreak >= 20) unlockAchievement("flawless_20");
  }

  function checkStarAchievements() {
    if (runState.runStars >= 50) unlockAchievement("starstruck");
    if (runState.runStars >= 100) unlockAchievement("star_hoarder");
    if (runState.runStars >= 200) unlockAchievement("galaxy_brain");
    if (runState.runStars >= 300) unlockAchievement("star_magnet");
  }

  function getAchievementWardrobeCycleProgress() {
    const permanentByCategory = {
      color: new Set(),
      cosmetic: new Set(),
      beard: new Set()
    };
    const permanentUnlocks = window.SlimePrestige
      ?.getPermanentWardrobeUnlocks?.() ?? [];
    permanentUnlocks.forEach(unlock => {
      const category = String(unlock?.category ?? "").toLowerCase();
      const id = String(unlock?.id ?? "").toLowerCase();
      permanentByCategory[category]?.add(id);
    });

    const withoutPermanentBaseline = (items, category) =>
      items.filter(id => !permanentByCategory[category].has(id));

    return {
      permanentByCategory,
      colors: withoutPermanentBaseline(unlockedSlimeColors, "color"),
      cosmetics: withoutPermanentBaseline(unlockedSlimeCosmetics, "cosmetic"),
      beards: withoutPermanentBaseline(unlockedSlimeBeards, "beard")
    };
  }

  function checkWardrobeAchievements() {
    if (
      typeof unlockedSlimeColors === "undefined" ||
      typeof unlockedSlimeCosmetics === "undefined" ||
      typeof unlockedSlimeBeards === "undefined"
    ) {
      return;
    }

    const cycleProgress = getAchievementWardrobeCycleProgress();
    if (cycleProgress.cosmetics.length > 0) unlockAchievement("fashion_slime");
    if (cycleProgress.beards.length > 0) unlockAchievement("glorious_beard");
    if (selectedSlimeCosmetic !== "none" && selectedSlimeBeard !== "none") {
      unlockAchievement("dressed_to_slime");
    }

    const unlockedWardrobeItemIds = new Set([
      ...cycleProgress.colors,
      ...cycleProgress.cosmetics,
      ...cycleProgress.beards
    ]);
    unlockedWardrobeItemIds.delete("none");
    if (unlockedWardrobeItemIds.size >= 25) {
      unlockAchievement("wardrobe_warrior");
    }

    const cycleColorTargets = typeof SLIME_COLOR_ORDER !== "undefined"
      ? SLIME_COLOR_ORDER.filter(
          color => !cycleProgress.permanentByCategory.color.has(color)
        )
      : [];
    const cycleCosmeticTargets = typeof UNLOCKABLE_SLIME_COSMETICS !== "undefined"
      ? UNLOCKABLE_SLIME_COSMETICS.filter(
          cosmetic => !cycleProgress.permanentByCategory.cosmetic.has(cosmetic)
        )
      : [];
    const cycleBeardTargets = typeof UNLOCKABLE_SLIME_BEARDS !== "undefined"
      ? UNLOCKABLE_SLIME_BEARDS.filter(
          beard => !cycleProgress.permanentByCategory.beard.has(beard)
        )
      : [];

    const allColorsUnlocked =
      typeof SLIME_COLOR_ORDER !== "undefined" &&
      SLIME_COLOR_ORDER.length > 0 &&
      cycleProgress.colors.some(color => color !== "green") &&
      cycleColorTargets.every(color => cycleProgress.colors.includes(color));
    const allCosmeticsUnlocked =
      typeof UNLOCKABLE_SLIME_COSMETICS !== "undefined" &&
      UNLOCKABLE_SLIME_COSMETICS.length > 0 &&
      cycleProgress.cosmetics.length > 0 &&
      cycleCosmeticTargets.every(cosmetic => cycleProgress.cosmetics.includes(cosmetic));
    const allBeardsUnlocked =
      typeof UNLOCKABLE_SLIME_BEARDS !== "undefined" &&
      UNLOCKABLE_SLIME_BEARDS.length > 0 &&
      cycleProgress.beards.length > 0 &&
      cycleBeardTargets.every(beard => cycleProgress.beards.includes(beard));

    if (allColorsUnlocked) {
      unlockAchievement("rainbow_slime");
    }
    if (allCosmeticsUnlocked) unlockAchievement("fashion_icon");
    if (allBeardsUnlocked) unlockAchievement("beard_baron");
    if (allColorsUnlocked && allCosmeticsUnlocked && allBeardsUnlocked) {
      unlockAchievement("full_wardrobe");
    }
  }

  function checkStateAchievements() {
    const playerProgress = window.SlimePlayerProgress?.getPlayerProgress?.();
    const playerLevel = Math.floor(Number(playerProgress?.level));
    if (Number.isFinite(playerLevel)) {
      if (playerLevel >= 10) unlockAchievement("slime_scholar");
      if (playerLevel >= 25) unlockAchievement("rising_prodigy");
      if (playerLevel >= 50) unlockAchievement("halfway_to_prestige");
      if (playerLevel >= 75) unlockAchievement("upper_class_slime");
      if (playerLevel >= 100) unlockAchievement("level_cap");
    }
    if (
      playerProgress?.isPrestigeReady === true ||
      window.SlimePlayerProgress?.isPrestigeReady?.() === true
    ) {
      unlockAchievement("ready_to_ascend");
    }

    const prestigeLevel = Math.floor(Number(window.SlimePrestige?.getLevel?.()));
    if (Number.isFinite(prestigeLevel)) {
      if (prestigeLevel >= 1) unlockAchievement("first_ascent");
      if (prestigeLevel >= 3) unlockAchievement("seasoned_soul");
      if (prestigeLevel >= 5) unlockAchievement("high_society");
      if (prestigeLevel >= 8) unlockAchievement("beyond_mortal");
      if (prestigeLevel >= 10) unlockAchievement("prestige_legend");
    }

    const permanentUnlocks = window.SlimePrestige
      ?.getPermanentWardrobeUnlocks?.() ?? [];
    if (permanentUnlocks.length >= 1) unlockAchievement("forever_fashionable");
    if (permanentUnlocks.length >= 5) unlockAchievement("heirloom_collection");
    if (permanentUnlocks.length >= 10) unlockAchievement("legacy_closet");
    const permanentCategories = new Set(
      permanentUnlocks.map(unlock => String(unlock?.category ?? "").toLowerCase())
    );
    if (["color", "cosmetic", "beard"].every(category => permanentCategories.has(category))) {
      unlockAchievement("three_of_a_kind");
    }

    const perkDefinitions = window.SlimePerks?.definitions ?? [];
    const implementedPerkIds = perkDefinitions
      .filter(perk => perk?.implemented === true)
      .map(perk => String(perk.id));
    const unlockedPerkIds = window.SlimePerks?.getStoredUnlockedPerkIds?.() ?? [];
    const selectedPerkIds = window.SlimePerks?.getStoredSelectedPerkIds?.() ?? [];
    if (unlockedPerkIds.length >= 1) unlockAchievement("perk_up");
    if (
      implementedPerkIds.length > 0 &&
      implementedPerkIds.every(id => unlockedPerkIds.includes(id))
    ) {
      unlockAchievement("fully_loaded");
    }
    if (selectedPerkIds.length >= 3) unlockAchievement("triple_threat");

    const gold = window.SlimeGold;
    if (gold?.ownsGoldSlime?.() === true) unlockAchievement("golden_ticket");
    if (gold?.isGoldSlimeMasteryUnlocked?.() === true) {
      unlockAchievement("true_alchemy");
    }
    if (gold?.isGoldHatMasteryUnlocked?.() === true) {
      unlockAchievement("crowned_in_gold");
    }
    if (gold?.isGoldBeardMasteryUnlocked?.() === true) {
      unlockAchievement("beard_of_midas");
    }
    const goldProgress = gold?.getProgress?.();
    if ((goldProgress?.hats?.purchasedGoldHatIds?.length ?? 0) > 0) {
      unlockAchievement("gold_rush");
    }
    if ((goldProgress?.beards?.purchasedGoldBeardIds?.length ?? 0) > 0) {
      unlockAchievement("bullion_barber");
    }
    const goldHatIds = gold?.getGoldHatIds?.() ?? [];
    const goldBeardIds = gold?.getGoldBeardIds?.() ?? [];
    if (
      gold?.ownsGoldSlime?.() === true &&
      goldHatIds.length > 0 &&
      goldBeardIds.length > 0 &&
      goldHatIds.every(id => gold.ownsGoldHat?.(id) === true) &&
      goldBeardIds.every(id => gold.ownsGoldBeard?.(id) === true)
    ) {
      unlockAchievement("all_that_glitters");
    }

    checkWardrobeAchievements();
    checkPersistentProgressAchievements();
    checkCompletionAchievements();
  }

  function getWardrobePurchaseTarget(category, itemId) {
    const normalizedCategory = String(category ?? "").toLowerCase();
    const normalizedId = String(itemId ?? "").toLowerCase();

    if (
      normalizedCategory === "color" &&
      typeof SLIME_COLOR_ORDER !== "undefined" &&
      SLIME_COLOR_ORDER.includes(normalizedId) &&
      typeof isSlimeColorUnlocked === "function" &&
      typeof unlockSlimeColor === "function"
    ) {
      return {
        category: normalizedCategory,
        id: normalizedId,
        isUnlocked: () => isSlimeColorUnlocked(normalizedId),
        unlock: () => unlockSlimeColor(normalizedId)
      };
    }

    if (
      normalizedCategory === "cosmetic" &&
      typeof UNLOCKABLE_SLIME_COSMETICS !== "undefined" &&
      UNLOCKABLE_SLIME_COSMETICS.includes(normalizedId) &&
      typeof isSlimeCosmeticUnlocked === "function" &&
      typeof unlockSlimeCosmetic === "function"
    ) {
      return {
        category: normalizedCategory,
        id: normalizedId,
        isUnlocked: () => isSlimeCosmeticUnlocked(normalizedId),
        unlock: () => unlockSlimeCosmetic(normalizedId)
      };
    }

    if (
      normalizedCategory === "beard" &&
      typeof UNLOCKABLE_SLIME_BEARDS !== "undefined" &&
      UNLOCKABLE_SLIME_BEARDS.includes(normalizedId) &&
      typeof isSlimeBeardUnlocked === "function" &&
      typeof unlockSlimeBeard === "function"
    ) {
      return {
        category: normalizedCategory,
        id: normalizedId,
        isUnlocked: () => isSlimeBeardUnlocked(normalizedId),
        unlock: () => unlockSlimeBeard(normalizedId)
      };
    }

    return null;
  }

  function isDevModeEnabled() {
    return typeof DEV_MODE !== "undefined" && DEV_MODE;
  }

  function getWardrobePurchaseKey(target) {
    return `${target.category}:${target.id}`;
  }

  function resetDevShopTestSession() {
    devShopTestBalance = DEV_SHOP_TEST_INITIAL_BALANCE;
    devShopTestUnlocks.clear();
  }

  function setDevShopTestActive(active) {
    if (!isDevModeEnabled()) return false;
    const nextActive = Boolean(active);
    if (nextActive === devShopTestActive) return devShopTestActive;

    resetDevShopTestSession();
    devShopTestActive = nextActive;
    return devShopTestActive;
  }

  function isDevShopTestItemUnlocked(category, itemId) {
    if (!devShopTestActive || !isDevModeEnabled()) return false;
    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target) return false;
    return target.isUnlocked() || devShopTestUnlocks.has(getWardrobePurchaseKey(target));
  }

  function canPurchaseDevShopTestItem(category, itemId) {
    if (!devShopTestActive || !isDevModeEnabled()) return false;
    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target || target.isUnlocked()) return false;
    const purchaseKey = getWardrobePurchaseKey(target);
    return !devShopTestUnlocks.has(purchaseKey) &&
      !activeWardrobePurchases.has(purchaseKey) &&
      devShopTestBalance >= WARDROBE_ITEM_STAR_PRICE;
  }

  function purchaseDevShopTestItem(category, itemId) {
    if (!devShopTestActive || !isDevModeEnabled()) {
      return {ok: false, reason: "dev-shop-inactive", balance: devShopTestBalance};
    }

    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target) {
      return {ok: false, reason: "invalid-item", balance: devShopTestBalance};
    }

    const purchaseKey = getWardrobePurchaseKey(target);
    if (target.isUnlocked() || devShopTestUnlocks.has(purchaseKey)) {
      return {ok: false, reason: "already-unlocked", balance: devShopTestBalance};
    }
    if (devShopTestBalance < WARDROBE_ITEM_STAR_PRICE) {
      return {ok: false, reason: "insufficient-stars", balance: devShopTestBalance};
    }
    if (activeWardrobePurchases.has(purchaseKey)) {
      return {ok: false, reason: "purchase-in-progress", balance: devShopTestBalance};
    }

    activeWardrobePurchases.add(purchaseKey);
    try {
      if (target.isUnlocked() || devShopTestUnlocks.has(purchaseKey)) {
        return {ok: false, reason: "already-unlocked", balance: devShopTestBalance};
      }

      devShopTestBalance -= WARDROBE_ITEM_STAR_PRICE;
      devShopTestUnlocks.add(purchaseKey);
      return {
        ok: true,
        test: true,
        category: target.category,
        id: target.id,
        price: WARDROBE_ITEM_STAR_PRICE,
        balance: devShopTestBalance
      };
    } finally {
      activeWardrobePurchases.delete(purchaseKey);
    }
  }

  function canPurchaseDevShopTestUnlock(request) {
    if (!devShopTestActive || !isDevModeEnabled()) return false;
    const normalized = normalizeStarUnlockRequest(request);
    if (!normalized || readStarUnlockState(normalized)) return false;
    return !activeWardrobePurchases.has(normalized.purchaseKey) &&
      devShopTestBalance >= normalized.price;
  }

  function purchaseDevShopTestUnlock(request) {
    if (!devShopTestActive || !isDevModeEnabled()) {
      return {ok: false, reason: "dev-shop-inactive", balance: devShopTestBalance};
    }
    const normalized = normalizeStarUnlockRequest(request);
    if (!normalized) {
      return {ok: false, reason: "invalid-purchase", balance: devShopTestBalance};
    }
    if (readStarUnlockState(normalized)) {
      return {ok: false, reason: "already-unlocked", balance: devShopTestBalance};
    }
    if (devShopTestBalance < normalized.price) {
      return {ok: false, reason: "insufficient-stars", balance: devShopTestBalance};
    }
    if (activeWardrobePurchases.has(normalized.purchaseKey)) {
      return {ok: false, reason: "purchase-in-progress", balance: devShopTestBalance};
    }

    activeWardrobePurchases.add(normalized.purchaseKey);
    const previousBalance = devShopTestBalance;
    try {
      devShopTestBalance -= normalized.price;
      let unlocked = false;
      try {
        unlocked = normalized.unlock() === true;
      } catch (_) {
        unlocked = false;
      }
      if (!unlocked || !readStarUnlockState(normalized)) {
        try { normalized.rollback?.(); } catch (_) {}
        devShopTestBalance = previousBalance;
        return {ok: false, reason: "unlock-failed", balance: devShopTestBalance};
      }
      return {
        ok: true,
        test: true,
        purchaseKey: normalized.purchaseKey,
        price: normalized.price,
        balance: devShopTestBalance
      };
    } finally {
      activeWardrobePurchases.delete(normalized.purchaseKey);
    }
  }

  function refillDevShopTestBalance() {
    if (!devShopTestActive || !isDevModeEnabled()) return false;
    devShopTestBalance = DEV_SHOP_TEST_INITIAL_BALANCE;
    return true;
  }

  function normalizeStarUnlockRequest(request) {
    if (!request || typeof request !== "object") return null;
    const purchaseKey = typeof request.purchaseKey === "string"
      ? request.purchaseKey.trim()
      : "";
    const price = Number(request.price);
    if (
      purchaseKey.length === 0 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      typeof request.isUnlocked !== "function" ||
      typeof request.unlock !== "function"
    ) return null;
    return {
      purchaseKey,
      price,
      isUnlocked: request.isUnlocked,
      unlock: request.unlock,
      rollback: typeof request.rollback === "function" ? request.rollback : null
    };
  }

  function readStarUnlockState(request) {
    try {
      return request.isUnlocked() === true;
    } catch (_) {
      return true;
    }
  }

  function canPurchaseUnlock(request) {
    if (isDevModeEnabled()) return false;
    const normalized = normalizeStarUnlockRequest(request);
    if (!normalized || readStarUnlockState(normalized)) return false;
    return !activeWardrobePurchases.has(normalized.purchaseKey) &&
      starBalance >= normalized.price;
  }

  function purchaseUnlock(request) {
    if (isDevModeEnabled()) {
      return {ok: false, reason: "dev-mode", balance: starBalance};
    }
    const normalized = normalizeStarUnlockRequest(request);
    if (!normalized) {
      return {ok: false, reason: "invalid-purchase", balance: starBalance};
    }
    if (readStarUnlockState(normalized)) {
      return {ok: false, reason: "already-unlocked", balance: starBalance};
    }
    if (starBalance < normalized.price) {
      return {ok: false, reason: "insufficient-stars", balance: starBalance};
    }
    if (activeWardrobePurchases.has(normalized.purchaseKey)) {
      return {ok: false, reason: "purchase-in-progress", balance: starBalance};
    }

    activeWardrobePurchases.add(normalized.purchaseKey);
    try {
      if (readStarUnlockState(normalized)) {
        return {ok: false, reason: "already-unlocked", balance: starBalance};
      }
      if (starBalance < normalized.price) {
        return {ok: false, reason: "insufficient-stars", balance: starBalance};
      }

      const previousBalance = starBalance;
      starBalance -= normalized.price;
      let unlocked = false;
      try {
        unlocked = normalized.unlock() === true;
      } catch (_) {
        unlocked = false;
      }
      if (!unlocked || !readStarUnlockState(normalized)) {
        try { normalized.rollback?.(); } catch (_) {}
        starBalance = previousBalance;
        return {ok: false, reason: "unlock-failed", balance: starBalance};
      }

      if (!saveStarBalanceVerified()) {
        let rolledBack = false;
        try {
          rolledBack = normalized.rollback?.() === true;
        } catch (_) {
          rolledBack = false;
        }
        if (rolledBack) starBalance = previousBalance;
        saveStarBalance();
        return {ok: false, reason: "storage-error", balance: starBalance};
      }

      return {
        ok: true,
        purchaseKey: normalized.purchaseKey,
        price: normalized.price,
        balance: starBalance
      };
    } finally {
      activeWardrobePurchases.delete(normalized.purchaseKey);
    }
  }

  function canPurchaseWardrobeItem(category, itemId) {
    if (isDevModeEnabled()) return false;
    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target || target.isUnlocked()) return false;
    const purchaseKey = getWardrobePurchaseKey(target);
    return !activeWardrobePurchases.has(purchaseKey) &&
      starBalance >= WARDROBE_ITEM_STAR_PRICE;
  }

  function purchaseWardrobeItem(category, itemId) {
    if (isDevModeEnabled()) {
      return {ok: false, reason: "dev-mode", balance: starBalance};
    }

    const target = getWardrobePurchaseTarget(category, itemId);
    if (!target) return {ok: false, reason: "invalid-item", balance: starBalance};
    if (target.isUnlocked()) {
      return {ok: false, reason: "already-unlocked", balance: starBalance};
    }
    if (starBalance < WARDROBE_ITEM_STAR_PRICE) {
      return {ok: false, reason: "insufficient-stars", balance: starBalance};
    }

    const purchaseKey = getWardrobePurchaseKey(target);
    if (activeWardrobePurchases.has(purchaseKey)) {
      return {ok: false, reason: "purchase-in-progress", balance: starBalance};
    }

    activeWardrobePurchases.add(purchaseKey);
    try {
      if (target.isUnlocked()) {
        return {ok: false, reason: "already-unlocked", balance: starBalance};
      }

      starBalance -= WARDROBE_ITEM_STAR_PRICE;
      let unlocked = false;
      try {
        unlocked = target.unlock();
      } catch (_) {
        unlocked = false;
      }
      if (!unlocked) {
        starBalance += WARDROBE_ITEM_STAR_PRICE;
        return {ok: false, reason: "unlock-failed", balance: starBalance};
      }

      saveStarBalance();
      checkWardrobeAchievements();
      return {
        ok: true,
        category: target.category,
        id: target.id,
        price: WARDROBE_ITEM_STAR_PRICE,
        balance: starBalance
      };
    } finally {
      activeWardrobePurchases.delete(purchaseKey);
    }
  }

  function addUniqueProgressValue(values, value) {
    if (!value || values.includes(value)) return false;
    values.push(value);
    return true;
  }

  function getCurrentLookKey() {
    if (
      typeof selectedSlimeColor === "undefined" ||
      typeof selectedSlimeCosmetic === "undefined" ||
      typeof selectedSlimeBeard === "undefined"
    ) {
      return null;
    }
    const lookKey = [
      selectedSlimeColor,
      selectedSlimeCosmetic,
      selectedSlimeBeard
    ].join("|");
    return isRegisteredLookKey(lookKey) ? lookKey : null;
  }

  function getLifetimeAirTime() {
    return achievementProgress.lifetimeAirTime + runState.lifetimeAirTimePending;
  }

  function flushLifetimeAirTime({save = true} = {}) {
    if (runState.lifetimeAirTimePending <= 0) return false;
    achievementProgress.lifetimeAirTime += runState.lifetimeAirTimePending;
    runState.lifetimeAirTimePending = 0;
    if (save) saveAchievementProgress();
    if (achievementProgress.lifetimeAirTime >= 60) {
      unlockAchievement("frequent_flyer");
    }
    return true;
  }

  function checkPersistentProgressAchievements() {
    const existingBiomeIds = getExistingBiomeIds();
    if (
      existingBiomeIds.length > 0 &&
      existingBiomeIds.every(id => achievementProgress.perfectBiomeIds.includes(id))
    ) {
      unlockAchievement("perfect_tourist");
    }
    if (
      existingBiomeIds.length > 0 &&
      existingBiomeIds.every(id => achievementProgress.deathFreeBiomeIds.includes(id))
    ) {
      unlockAchievement("biome_master");
    }
    if (
      NIGHT_BIOME_IDS.every(id => existingBiomeIds.includes(id)) &&
      NIGHT_BIOME_IDS.every(id => achievementProgress.discoveredBiomeIds.includes(id))
    ) {
      unlockAchievement("after_dark");
    }
    if (
      CAVE_BIOME_IDS.every(id => existingBiomeIds.includes(id)) &&
      CAVE_BIOME_IDS.every(id => achievementProgress.perfectBiomeIds.includes(id))
    ) {
      unlockAchievement("cave_connoisseur");
    }
    if (
      NEW_BIOME_IDS.every(id => existingBiomeIds.includes(id)) &&
      NEW_BIOME_IDS.every(id => achievementProgress.perfectBiomeIds.includes(id))
    ) {
      unlockAchievement("new_world_perfection");
    }
    if (achievementProgress.lifetimeStars >= 1000) unlockAchievement("star_bank");
    if (getLifetimeAirTime() >= 60) unlockAchievement("frequent_flyer");
    if (achievementProgress.completedLookIds.length >= 10) unlockAchievement("style_master");
    if (achievementProgress.lifetimePerfects >= 25) unlockAchievement("perfect_25");
    if (achievementProgress.lifetimeCompletedLevels >= 100) {
      unlockAchievement("veteran_slime");
    }
    if (achievementProgress.lifetimeCompletedLevels >= 500) {
      unlockAchievement("the_long_memory");
    }
    if (achievementProgress.lifetimeDeaths >= 25) unlockAchievement("ouch");
  }

  function recordBiomeReached(biomeId) {
    const id = String(biomeId ?? "");
    const existingBiomeIds = getExistingBiomeIds();
    if (!existingBiomeIds.includes(id)) return;

    runState.runBiomeIds.add(id);
    if (!achievementProgress.discoveredBiomeIds.includes(id)) {
      achievementProgress.discoveredBiomeIds.push(id);
      saveAchievementProgress();
    }

    if (id === "sky") unlockAchievement("head_in_the_clouds");
    if (id === "stormNight") unlockAchievement("storm_chaser");
    if (id === "undergroundTemple") unlockAchievement("temple_threshold");
    if (
      existingBiomeIds.length > 0 &&
      existingBiomeIds.every(existingId =>
        achievementProgress.discoveredBiomeIds.includes(existingId)
      )
    ) {
      unlockAchievement("world_traveler");
    }
  }

  function resetLevelState({levelNumber = 1, biomeId = null, hasGhost = false} = {}) {
    runState.levelNumber = Math.max(1, Math.floor(Number(levelNumber) || 1));
    runState.biomeId = biomeId === null ? null : String(biomeId);
    runState.levelElapsed = 0;
    runState.levelHadDeath = false;
    runState.levelHasGhost = Boolean(hasGhost);
    runState.ghostHit = false;
    runState.bounceStreak = 0;
    runState.levelShots = 0;
    runState.shotActive = false;
    runState.starsSinceShot = 0;
    runState.airTime = 0;
    runState.rescueUsed = false;
  }

  function onBiomeReached({levelNumber = 1, biomeId = null} = {}) {
    const id = String(biomeId ?? "");
    const biomeIds = getExistingBiomeIds();
    if (!biomeIds.includes(id)) return;

    const firstBiomeId = biomeIds[0];
    const lastBiomeId = biomeIds[biomeIds.length - 1];
    const numericLevel = Math.max(1, Math.floor(Number(levelNumber) || 1));

    if (
      runState.rotationComplete &&
      id === firstBiomeId &&
      runState.previousBiomeId === lastBiomeId &&
      numericLevel > runState.previousLevelNumber
    ) {
      unlockAchievement("round_two");
    }

    recordBiomeReached(id);
    if (biomeIds.every(existingId => runState.runBiomeIds.has(existingId))) {
      runState.rotationComplete = true;
    }
    runState.previousBiomeId = id;
    runState.previousLevelNumber = numericLevel;
  }

  function onLevelStart({levelNumber = 1, biomeId = null, hasGhost = false} = {}) {
    const numericLevel = Math.max(1, Math.floor(Number(levelNumber) || 1));
    if (runState.groundhogLevelNumber !== numericLevel) {
      runState.groundhogLevelNumber = numericLevel;
      runState.groundhogDeaths = 0;
    }
    resetLevelState({levelNumber, biomeId, hasGhost});
    onBiomeReached({levelNumber, biomeId});
  }

  function onRunStart({levelNumber = 1, biomeId = null, hasGhost = false} = {}) {
    flushLifetimeAirTime();
    runState.perfectStreak = 0;
    runState.cleanLevelStreak = 0;
    runState.completedLevels = 0;
    runState.ghostCleanLevels = 0;
    runState.speedLevels = 0;
    runState.perfectClearLevels = 0;
    runState.runStars = 0;
    runState.runBiomeIds = new Set();
    runState.rotationComplete = false;
    runState.previousBiomeId = null;
    runState.previousLevelNumber = 0;
    onLevelStart({levelNumber, biomeId, hasGhost});
    checkStateAchievements();
  }

  function onFrame(dt, {grounded = false} = {}) {
    const elapsed = Math.max(0, Number(dt) || 0);
    runState.levelElapsed += elapsed;
    if (!grounded) {
      runState.airTime += elapsed;
      runState.lifetimeAirTimePending += elapsed;
      if (
        runState.lifetimeAirTimePending >= 10 ||
        (!unlockedById.has("frequent_flyer") && getLifetimeAirTime() >= 60)
      ) {
        flushLifetimeAirTime();
      }
    }
  }

  function onShot({levelShots = null, usedRescue = false} = {}) {
    const providedShots = levelShots === null ? NaN : Math.floor(Number(levelShots));
    runState.levelShots = Number.isFinite(providedShots)
      ? Math.max(0, providedShots)
      : runState.levelShots + 1;
    runState.shotActive = true;
    runState.starsSinceShot = 0;
    if (usedRescue) onRescueUsed();
  }

  function onStarCollected({runStars = null} = {}) {
    const providedStars = runStars === null ? NaN : Math.floor(Number(runStars));
    runState.runStars = Number.isFinite(providedStars)
      ? Math.max(0, providedStars)
      : runState.runStars + 1;
    achievementProgress.lifetimeStars++;
    starBalance++;
    saveAchievementProgress();
    saveStarBalance();
    checkStarAchievements();
    if (achievementProgress.lifetimeStars >= 1000) unlockAchievement("star_bank");

    if (runState.shotActive) {
      runState.starsSinceShot++;
      if (runState.starsSinceShot >= 3) {
        unlockAchievement("secret_star_sniper");
      }
    }
  }

  function onBounce() {
    runState.bounceStreak++;
    if (runState.bounceStreak >= 3) unlockAchievement("bounce_master");
    if (runState.bounceStreak >= 10) unlockAchievement("bounce_addict");
    if (runState.bounceStreak >= 25) unlockAchievement("bounce_marathon");
  }

  function onLanding() {
    if (runState.airTime >= 5) unlockAchievement("secret_air_time");
    runState.airTime = 0;
    runState.bounceStreak = 0;
    runState.shotActive = false;
    runState.starsSinceShot = 0;
  }

  function onGhostHit() {
    runState.ghostHit = true;
  }

  function onRescueUsed() {
    runState.rescueUsed = true;
  }

  function getDeathTimestamp() {
    return Date.now();
  }

  function checkRagequitter() {
    const now = getDeathTimestamp();
    recentDeathTimestamps.push(now);
    while (
      recentDeathTimestamps.length > 0 &&
      now - recentDeathTimestamps[0] > 5000
    ) {
      recentDeathTimestamps.shift();
    }
    if (
      recentDeathTimestamps.length >= 3 &&
      now - recentDeathTimestamps[recentDeathTimestamps.length - 3] <= 5000
    ) {
      unlockAchievement("secret_ragequitter");
    }
  }

  function onDeath() {
    flushLifetimeAirTime({save: false});
    runState.levelHadDeath = true;
    runState.perfectStreak = 0;
    runState.cleanLevelStreak = 0;
    runState.groundhogDeaths++;
    runState.bounceStreak = 0;
    runState.airTime = 0;
    runState.shotActive = false;
    runState.starsSinceShot = 0;
    achievementProgress.lifetimeDeaths++;
    saveAchievementProgress();
    if (achievementProgress.lifetimeDeaths >= 25) unlockAchievement("ouch");
    checkRagequitter();
  }

  function onLevelCompleted({
    isPerfect = false,
    hadDeath = false,
    hasGhost = null,
    biomeId = null,
    levelNumber = null,
    levelShots = null,
    remainingLives = null,
    collectedStars = null,
    totalStars = null
  } = {}) {
    const diedInLevel = Boolean(hadDeath || runState.levelHadDeath);
    const perfectLevel = Boolean(isPerfect && !diedInLevel);
    if (perfectLevel) {
      runState.perfectStreak++;
      checkPerfectAchievements();
    } else {
      runState.perfectStreak = 0;
    }

    if (diedInLevel) {
      runState.cleanLevelStreak = 0;
    } else {
      runState.cleanLevelStreak++;
      if (runState.cleanLevelStreak >= 10) unlockAchievement("clean_run");
      if (runState.cleanLevelStreak >= 25) unlockAchievement("clean_machine");
      if (runState.cleanLevelStreak >= 50) unlockAchievement("clean_50");
    }

    runState.completedLevels++;
    if (runState.completedLevels >= 25) unlockAchievement("long_haul");
    if (runState.completedLevels >= 50) unlockAchievement("marathon_slime");
    if (runState.completedLevels >= 100) unlockAchievement("century_slime");
    if (runState.completedLevels >= 200) unlockAchievement("run_200");

    const actualCollectedStars = collectedStars === null
      ? NaN
      : Math.floor(Number(collectedStars));
    const actualTotalStars = totalStars === null
      ? NaN
      : Math.floor(Number(totalStars));
    const hasCollectibleStars =
      Number.isFinite(actualCollectedStars) &&
      Number.isFinite(actualTotalStars) &&
      actualCollectedStars >= 0 &&
      actualTotalStars > 0;
    const isPerfectClear =
      hasCollectibleStars && actualCollectedStars === actualTotalStars;
    if (isPerfectClear) {
      unlockAchievement("perfect_clear");
      runState.perfectClearLevels++;
      if (runState.perfectClearLevels >= 3) unlockAchievement("clean_sweep");
    }
    if (hasCollectibleStars && actualCollectedStars === 0) {
      unlockAchievement("empty_handed");
    }
    if (
      hasCollectibleStars &&
      actualTotalStars === 3 &&
      actualCollectedStars === 2
    ) {
      unlockAchievement("two_out_of_three");
    }

    if (Math.floor(Number(remainingLives)) === 1) unlockAchievement("not_today");

    const levelHasGhost = hasGhost === null
      ? runState.levelHasGhost
      : Boolean(hasGhost);
    if (levelHasGhost && !runState.ghostHit) {
      unlockAchievement("ghostbuster");
      runState.ghostCleanLevels++;
      if (runState.ghostCleanLevels >= 5) unlockAchievement("ghost_whisperer");
    }
    if (runState.levelElapsed <= 5) {
      unlockAchievement("speed_slime");
      runState.speedLevels++;
      if (runState.speedLevels >= 3) unlockAchievement("speed_demon");
    }
    if (runState.levelElapsed >= 120 && !diedInLevel) {
      unlockAchievement("secret_take_your_time");
    }

    const completedBiomeId = String(biomeId ?? runState.biomeId ?? "");
    if (!diedInLevel && completedBiomeId === "snow") unlockAchievement("ice_cold");
    if (!diedInLevel && completedBiomeId === "volcano") unlockAchievement("hot_stuff");

    const completedLevelNumber = levelNumber === null
      ? runState.levelNumber
      : Math.max(1, Math.floor(Number(levelNumber) || 1));
    if (completedLevelNumber >= 10) unlockAchievement("meadow_graduate");
    if (completedLevelNumber >= 100) unlockAchievement("old_world_complete");
    if (completedLevelNumber >= 200) unlockAchievement("worlds_end");
    if (completedLevelNumber >= 300) unlockAchievement("beyond_the_map");
    if (completedLevelNumber === 404) unlockAchievement("secret_achievement_404");

    const rotationLevelCount = getExistingBiomeIds().length * LEVELS_PER_BIOME;
    if (
      rotationLevelCount > 0 &&
      completedLevelNumber % rotationLevelCount === 0 &&
      runState.rotationComplete
    ) {
      unlockAchievement("round_two");
    }
    if (
      runState.groundhogLevelNumber === completedLevelNumber &&
      runState.groundhogDeaths >= 5
    ) {
      unlockAchievement("secret_groundhog_slime");
    }

    const providedShots = levelShots === null ? NaN : Math.floor(Number(levelShots));
    const actualShots = Number.isFinite(providedShots)
      ? Math.max(0, providedShots)
      : runState.levelShots;
    if (actualShots === 1) unlockAchievement("secret_one_shot");
    if (actualShots === 2) unlockAchievement("double_tap");
    if (runState.rescueUsed) unlockAchievement("secret_second_chance");

    if (
      completedBiomeId === "pirateHarbor" &&
      perfectLevel &&
      actualShots === 1
    ) {
      unlockAchievement("secret_pirates_code");
    }
    const goldAppearance = window.SlimeGold?.getEquippedAppearance?.() ?? {
      slime: false,
      hatId: null,
      beardId: null
    };
    if (
      completedBiomeId === "alienJungle" &&
      perfectLevel &&
      typeof selectedSlimeColor !== "undefined" &&
      typeof selectedSlimeCosmetic !== "undefined" &&
      typeof selectedSlimeBeard !== "undefined" &&
      selectedSlimeColor === "green" &&
      selectedSlimeCosmetic === "none" &&
      selectedSlimeBeard === "none" &&
      goldAppearance.slime !== true &&
      goldAppearance.hatId === null &&
      goldAppearance.beardId === null
    ) {
      unlockAchievement("secret_first_contact");
    }
    if (
      completedBiomeId === "redMoon" &&
      perfectLevel &&
      Math.floor(Number(remainingLives)) === 1
    ) {
      unlockAchievement("secret_blood_moon");
    }
    if (
      completedBiomeId === "undergroundTemple" &&
      !diedInLevel &&
      hasCollectibleStars &&
      actualCollectedStars === 0
    ) {
      unlockAchievement("secret_temple_raider");
    }
    if (
      !diedInLevel &&
      hasCollectibleStars &&
      actualCollectedStars === 0 &&
      Math.floor(Number(remainingLives)) === 1
    ) {
      unlockAchievement("secret_bare_minimum");
    }
    if (
      goldAppearance.slime === true &&
      goldAppearance.hatId !== null &&
      goldAppearance.beardId !== null
    ) {
      unlockAchievement("secret_gold_standard");
    }
    if ((window.SlimePerks?.getActiveRunPerkIds?.() ?? []).length >= 3) {
      unlockAchievement("build_online");
    }

    flushLifetimeAirTime({save: false});
    achievementProgress.lifetimeCompletedLevels++;
    if (perfectLevel) achievementProgress.lifetimePerfects++;

    const existingBiomeIds = getExistingBiomeIds();
    if (existingBiomeIds.includes(completedBiomeId)) {
      if (perfectLevel) {
        addUniqueProgressValue(achievementProgress.perfectBiomeIds, completedBiomeId);
      }
      if (!diedInLevel) {
        addUniqueProgressValue(achievementProgress.deathFreeBiomeIds, completedBiomeId);
      }
    }

    const lookKey = getCurrentLookKey();
    if (lookKey) addUniqueProgressValue(achievementProgress.completedLookIds, lookKey);
    saveAchievementProgress();
    checkStateAchievements();
  }

  try {
    localStorage.setItem(
      ACHIEVEMENT_PROGRESS_VERSION_STORAGE_KEY,
      ACHIEVEMENT_PROGRESS_VERSION
    );
  } catch (_) {}

  window.SlimeAchievements = Object.freeze({
    registry: ACHIEVEMENT_REGISTRY,
    unlock: unlockAchievement,
    getUnlocked: () => unlockedAchievements.map(unlock => ({...unlock})),
    getRecent: getRecentAchievements,
    getSelectedBadgeIds: getSelectedAchievementBadgeIds,
    getEffectiveBadgeIds: getEffectiveCallingCardBadgeIds,
    getProgress: () => ({
      discoveredBiomeIds: achievementProgress.discoveredBiomeIds.slice(),
      perfectBiomeIds: achievementProgress.perfectBiomeIds.slice(),
      deathFreeBiomeIds: achievementProgress.deathFreeBiomeIds.slice(),
      completedLookIds: achievementProgress.completedLookIds.slice(),
      lifetimeStars: achievementProgress.lifetimeStars,
      lifetimeAirTime: getLifetimeAirTime(),
      lifetimeCompletedLevels: achievementProgress.lifetimeCompletedLevels,
      lifetimeDeaths: achievementProgress.lifetimeDeaths,
      lifetimePerfects: achievementProgress.lifetimePerfects
    }),
    getLifetimeStats: () => ({
      stars: achievementProgress.lifetimeStars,
      airTime: getLifetimeAirTime(),
      completedLevels: achievementProgress.lifetimeCompletedLevels,
      deaths: achievementProgress.lifetimeDeaths,
      perfects: achievementProgress.lifetimePerfects
    }),
    renderMenu: renderAchievementMenu,
    renderRecent: renderRecentAchievements,
    setPopupsPaused: setAchievementPopupsPaused,
    checkWardrobe: checkWardrobeAchievements,
    checkState: checkStateAchievements,
    isRunProgressSnapshotValid,
    captureRunProgressSnapshot,
    restoreRunProgressSnapshot,
    discardRunProgressSnapshot,
    onRunStart,
    onLevelStart,
    onLevelCompleted,
    onFrame,
    onShot,
    onStarCollected,
    onBounce,
    onLanding,
    onDeath,
    onGhostHit,
    onRescueUsed,
    onBiomeReached
  });

  window.SlimeStarEconomy = Object.freeze({
    itemPrice: WARDROBE_ITEM_STAR_PRICE,
    receiptStorageKey: STAR_AWARD_RECEIPTS_STORAGE_KEY,
    getBalance: () => starBalance,
    getLifetimeStars: () => achievementProgress.lifetimeStars,
    awardStars,
    applyPerkMigrationBalance,
    isPurchaseInProgress: () => activeWardrobePurchases.size > 0,
    canPurchaseUnlock,
    purchaseUnlock,
    canPurchaseWardrobeItem,
    purchaseWardrobeItem
  });

  window.SlimeDevShopTest = Object.freeze({
    itemPrice: WARDROBE_ITEM_STAR_PRICE,
    initialBalance: DEV_SHOP_TEST_INITIAL_BALANCE,
    isActive: () => devShopTestActive && isDevModeEnabled(),
    setActive: setDevShopTestActive,
    getBalance: () => devShopTestBalance,
    isItemUnlocked: isDevShopTestItemUnlocked,
    canPurchaseUnlock: canPurchaseDevShopTestUnlock,
    purchaseUnlock: purchaseDevShopTestUnlock,
    canPurchaseWardrobeItem: canPurchaseDevShopTestItem,
    purchaseWardrobeItem: purchaseDevShopTestItem,
    refillBalance: refillDevShopTestBalance
  });

  window.SlimeRunRecovery?.recoverInterruptedRun?.({
    isAchievementSnapshotValid: isRunProgressSnapshotValid,
    isWardrobeSnapshotValid: isWardrobeRunProgressSnapshotValid,
    restoreAchievementSnapshot: restoreRunProgressSnapshot,
    restoreWardrobeSnapshot: restoreWardrobeRunProgressSnapshot
  });

  if (typeof window.addEventListener === "function") {
    window.addEventListener("slimegoldchange", checkStateAchievements);
    window.addEventListener("DOMContentLoaded", checkStateAchievements, {once: true});
  }

  checkStateAchievements();
  renderAchievementViews();
})();

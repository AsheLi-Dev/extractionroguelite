// Talent Tree Testing Helper Script
// Copy and paste this into browser console to test talent tree functionality

(function() {
  const TALENTS_KEY = 'spaceShooter_talents';
  const LP_KEY = 'spaceShooter_legacyPoints';

  // Helper functions
  window.testTalents = {
    // Get current state
    getState: function() {
      const talents = JSON.parse(localStorage.getItem(TALENTS_KEY) || '[]');
      const lp = parseInt(localStorage.getItem(LP_KEY) || '0');
      return { talents, lp };
    },

    // Set LP for testing
    setLP: function(amount) {
      localStorage.setItem(LP_KEY, String(amount));
      console.log(`LP set to ${amount}`);
      return amount;
    },

    // Clear all talents
    clearTalents: function() {
      localStorage.removeItem(TALENTS_KEY);
      console.log('All talents cleared');
    },

    // Manually add talent (bypasses validation)
    addTalent: function(talentId) {
      const talents = JSON.parse(localStorage.getItem(TALENTS_KEY) || '[]');
      if (!talents.includes(talentId)) {
        talents.push(talentId);
        localStorage.setItem(TALENTS_KEY, JSON.stringify(talents));
        console.log(`Added talent: ${talentId}`);
      } else {
        console.log(`Talent already exists: ${talentId}`);
      }
      return talents;
    },

    // Remove talent
    removeTalent: function(talentId) {
      const talents = JSON.parse(localStorage.getItem(TALENTS_KEY) || '[]');
      const filtered = talents.filter(id => id !== talentId);
      localStorage.setItem(TALENTS_KEY, JSON.stringify(filtered));
      console.log(`Removed talent: ${talentId}`);
      return filtered;
    },

    // Check if talent is purchased
    hasTalent: function(talentId) {
      const talents = JSON.parse(localStorage.getItem(TALENTS_KEY) || '[]');
      const has = talents.includes(talentId);
      console.log(`Talent "${talentId}": ${has ? 'PURCHASED' : 'NOT PURCHASED'}`);
      return has;
    },

    // List all purchased talents
    listTalents: function() {
      const talents = JSON.parse(localStorage.getItem(TALENTS_KEY) || '[]');
      console.log('Purchased talents:', talents);
      return talents;
    },

    // Reset everything
    reset: function() {
      localStorage.removeItem(TALENTS_KEY);
      localStorage.setItem(LP_KEY, '0');
      console.log('Talent system reset');
    },

    // Test purchase flow
    testPurchase: function(talentId, cost) {
      const state = this.getState();
      console.log(`Testing purchase of "${talentId}" (cost: ${cost})`);
      console.log(`Current LP: ${state.lp}, Current talents:`, state.talents);
      
      if (state.talents.includes(talentId)) {
        console.warn('Talent already purchased!');
        return false;
      }
      
      if (state.lp < cost) {
        console.warn(`Insufficient LP! Need ${cost}, have ${state.lp}`);
        return false;
      }
      
      console.log('✓ Preconditions met. Use UI to purchase, then check state.');
      return true;
    },

    // Verify parent requirements
    checkParents: function(talentId) {
      // Import talent tree data (would need to access from game)
      console.log('Parent check requires access to TALENT_TREE data');
      console.log('Manually verify parent requirements in src/data/talents.js');
    },

    // Quick test scenarios
    scenarios: {
      // Scenario 1: Basic purchase
      basicPurchase: function() {
        console.log('=== Scenario: Basic Purchase ===');
        testTalents.reset();
        testTalents.setLP(10);
        testTalents.testPurchase('fierce', 1);
        console.log('Expected: Purchase "fierce" in UI, LP should decrease to 9');
      },

      // Scenario 2: Parent requirement
      parentRequirement: function() {
        console.log('=== Scenario: Parent Requirement ===');
        testTalents.reset();
        testTalents.setLP(10);
        testTalents.addTalent('fierce');
        testTalents.testPurchase('bloodthirst', 2);
        console.log('Expected: "bloodthirst" should be available (parent "fierce" exists)');
      },

      // Scenario 3: Insufficient LP
      insufficientLP: function() {
        console.log('=== Scenario: Insufficient LP ===');
        testTalents.reset();
        testTalents.setLP(0);
        testTalents.testPurchase('fierce', 1);
        console.log('Expected: Purchase should fail, LP remains 0');
      },

      // Scenario 4: Refund prevention
      refundPrevention: function() {
        console.log('=== Scenario: Refund Prevention ===');
        testTalents.reset();
        testTalents.setLP(10);
        testTalents.addTalent('fierce');
        testTalents.addTalent('bloodthirst');
        console.log('Expected: Cannot refund "fierce" (has child "bloodthirst")');
        console.log('Expected: Can refund "bloodthirst" (no children)');
      },

      // Scenario 5: Full branch
      fullBranch: function() {
        console.log('=== Scenario: Full Branch Purchase ===');
        testTalents.reset();
        testTalents.setLP(50);
        console.log('Purchase entire Warrior branch:');
        console.log('Tier 1: fierce, rapid, resilient (1 LP each)');
        console.log('Tier 2: bloodthirst, predator, reflexes, ironWill (2 LP each)');
        console.log('Tier 3: frenzy, executioner, battleScarred, endurance, fortress (3 LP each)');
        console.log('Tier 4: berserkerRage, warlord, secondWind, immortal (4-5 LP each)');
      }
    }
  };

  console.log('=== Talent Tree Testing Helper ===');
  console.log('Available commands:');
  console.log('  testTalents.getState() - Get current LP and purchased talents');
  console.log('  testTalents.setLP(amount) - Set legacy points');
  console.log('  testTalents.clearTalents() - Clear all talents');
  console.log('  testTalents.addTalent(id) - Manually add talent');
  console.log('  testTalents.removeTalent(id) - Remove talent');
  console.log('  testTalents.hasTalent(id) - Check if talent purchased');
  console.log('  testTalents.listTalents() - List all purchased talents');
  console.log('  testTalents.reset() - Reset everything');
  console.log('  testTalents.testPurchase(id, cost) - Test purchase preconditions');
  console.log('');
  console.log('Test scenarios:');
  console.log('  testTalents.scenarios.basicPurchase()');
  console.log('  testTalents.scenarios.parentRequirement()');
  console.log('  testTalents.scenarios.insufficientLP()');
  console.log('  testTalents.scenarios.refundPrevention()');
  console.log('  testTalents.scenarios.fullBranch()');
  console.log('');
  console.log('Current state:', testTalents.getState());
})();

# Talent Tree Testing Guide

This document outlines comprehensive testing strategies for the talent tree system.

## Overview

The talent tree system consists of:
- **Data Layer** (`src/data/talents.js`): Core logic for purchasing, refunding, and checking talents
- **UI Layer** (`src/ui/talent-tree-ui.js`): Rendering and user interactions
- **Game Integration**: Talents affect gameplay stats, abilities, and mechanics

---

## 1. Data Layer Tests

### 1.1 Purchase System Tests

**Test: Basic Talent Purchase**
```javascript
// In browser console:
// 1. Clear localStorage: localStorage.removeItem('spaceShooter_talents')
// 2. Set LP: localStorage.setItem('spaceShooter_legacyPoints', '10')
// 3. Open talent tree and try purchasing "fierce" (cost: 1 LP)
// Expected: Talent purchases, LP decreases to 9, talent appears as purchased
```

**Test: Insufficient LP**
```javascript
// 1. Set LP to 0
// 2. Try purchasing any talent
// Expected: Purchase fails, LP remains 0, talent stays locked
```

**Test: Duplicate Purchase Prevention**
```javascript
// 1. Purchase "fierce"
// 2. Try purchasing "fierce" again
// Expected: Second purchase fails, LP not deducted again
```

**Test: Parent Requirement (parentsAll)**
```javascript
// 1. Try purchasing "bloodthirst" without "fierce"
// Expected: Talent is locked/unavailable
// 2. Purchase "fierce" first
// 3. Try purchasing "bloodthirst"
// Expected: Now available and purchasable
```

**Test: Parent Requirement (parentsAny)**
```javascript
// 1. Try purchasing "predator" (requires "fierce" OR "rapid")
// Expected: Locked if neither parent purchased
// 2. Purchase "fierce" OR "rapid"
// Expected: "predator" becomes available
```

**Test: Complex Parent Requirements**
```javascript
// Test "executioner" which requires ANY of ["bloodthirst", "predator"]
// 1. Purchase "fierce" → "bloodthirst"
// 2. "executioner" should become available
// OR
// 1. Purchase "fierce" → "predator"
// 2. "executioner" should become available
```

### 1.2 Refund System Tests

**Test: Basic Refund**
```javascript
// 1. Purchase "fierce" (cost: 1)
// 2. Refund "fierce"
// Expected: Talent removed, LP restored to original amount
```

**Test: Refund Prevention (Child Dependencies)**
```javascript
// 1. Purchase "fierce" → "bloodthirst" → "frenzy"
// 2. Try refunding "fierce"
// Expected: Cannot refund (has child "bloodthirst")
// 3. Try refunding "bloodthirst"
// Expected: Cannot refund (has child "frenzy")
// 4. Refund "frenzy" first
// Expected: Success
// 5. Now refund "bloodthirst"
// Expected: Success
// 6. Now refund "fierce"
// Expected: Success
```

**Test: Branch Refund**
```javascript
// 1. Purchase multiple talents in Warrior branch
// 2. Click "Refund all" button
// Expected: All refundable talents refunded in correct order (children first)
```

**Test: Refund Edge Cases**
```javascript
// 1. Purchase talent with no children
// 2. Refund should always work
// 3. Purchase root talent (tier 1) with children
// 4. Refund should fail until children refunded
```

### 1.3 State Persistence Tests

**Test: localStorage Persistence**
```javascript
// 1. Purchase several talents
// 2. Refresh page
// Expected: Talents still purchased, LP correctly deducted
```

**Test: Multiple Branch Purchases**
```javascript
// 1. Purchase talents from different branches (Warrior, Survivalist, etc.)
// 2. Verify all persist correctly
// Expected: All branches maintain their purchased state
```

---

## 2. UI Layer Tests

### 2.1 Visual State Tests

**Test: Node States**
- **Locked**: Grayed out, not clickable
- **Available**: Glowing/animated, clickable, shows cost
- **Purchased**: Green/checkmark, shows "✓ Purchased", clickable for refund

**Test: LP Display**
```javascript
// 1. Check LP value in talent tree header
// 2. Purchase talent
// Expected: LP updates immediately
```

**Test: Branch Rendering**
- All 4 branches (Warrior, Survivalist, Scavenger, Tinkerer) render correctly
- Grid positions match expected layout
- Connection lines render between parent-child nodes

### 2.2 Interaction Tests

**Test: Click to Purchase**
```javascript
// 1. Click available talent node
// Expected: Purchases if LP sufficient, tree re-renders
```

**Test: Click to Refund**
```javascript
// 1. Click purchased talent node (with refundable=true)
// Expected: Refunds talent, tree re-renders
```

**Test: Branch Refund Button**
```javascript
// 1. Purchase talents in a branch
// 2. Click "Refund all" button
// Expected: Confirmation dialog appears, then refunds all
```

**Test: Disabled States**
- Refund button disabled when branch has no purchased talents
- Locked talents not clickable
- Available talents disabled when LP insufficient

### 2.3 UI Edge Cases

**Test: Empty State**
```javascript
// 1. Start with no talents purchased
// Expected: All talents locked except tier 1 roots (if LP available)
```

**Test: Full Purchase**
```javascript
// 1. Purchase all talents in a branch
// Expected: All nodes show purchased state, refund button enabled
```

---

## 3. Game Integration Tests

### 3.1 Stat Modifier Tests

**Test: Fierce (+10% attack damage)**
```javascript
// 1. Note base attack stat
// 2. Purchase "fierce"
// 3. Start new run
// Expected: Attack stat increased by 10%
```

**Test: Resilient (+10% max health)**
```javascript
// 1. Note base max health
// 2. Purchase "resilient"
// 3. Start new run
// Expected: Max health increased by 10%
```

**Test: Rapid (+10% attack speed)**
```javascript
// 1. Purchase "rapid"
// 2. Start new run
// Expected: Attack speed multiplier = 1.1
```

**Test: Stacking Modifiers**
```javascript
// 1. Purchase "fierce" and "ironFist" (+10% attack each)
// Expected: Attack should be base * 1.1 * 1.1
```

### 3.2 Ability/Mechanic Tests

**Test: Reflexes (Dash Cooldown)**
```javascript
// 1. Purchase "reflexes" (reduces dash cooldown by 0.1s)
// 2. Start run, use dash
// Expected: Dash cooldown reduced from 0.8s to 0.7s (or 0.7s to 0.6s with swiftExtraction)
```

**Test: Bloodthirst (Health on Kill)**
```javascript
// 1. Purchase "bloodthirst"
// 2. Kill enemy
// Expected: Restore 3% max health
```

**Test: Predator (Low Health Damage)**
```javascript
// 1. Purchase "predator"
// 2. Attack enemy below 25% health
// Expected: Greatly increased damage
```

**Test: Executioner (Low Health Bonus)**
```javascript
// 1. Purchase "executioner"
// 2. Use skills on low-health enemies (<30%)
// Expected: 25% increased skill damage
```

### 3.3 Loot/Drop Rate Tests

**Test: Arcane Eye (+20% mod card drop rate)**
```javascript
// 1. Purchase "arcaneEye"
// 2. Play run, count mod card drops
// Expected: Increased drop rate (statistical test over many runs)
```

**Test: Keen Eye (+15% equipment drop rate)**
```javascript
// 1. Purchase "keenEye"
// 2. Play run, count equipment drops
// Expected: Increased drop rate
```

### 3.4 Special Ability Tests

**Test: Second Wind (Survive Killing Blow)**
```javascript
// 1. Purchase "secondWind"
// 2. Take lethal damage
// Expected: Survive once per run, skill cooldowns refresh
```

**Test: Immortal (Survive at 1 HP)**
```javascript
// 1. Purchase "immortal"
// 2. Take lethal damage
// Expected: Survive at 1 HP once per run, gain damage reduction
```

**Test: Vault Master (Legacy Vault Capacity)**
```javascript
// 1. Purchase "vaultMaster"
// 2. Check Legacy Vault
// Expected: Capacity increases from 5 to 8 items
```

---

## 4. Edge Cases & Boundary Tests

### 4.1 Data Integrity

**Test: Corrupted localStorage**
```javascript
// 1. Manually corrupt talents data: localStorage.setItem('spaceShooter_talents', 'invalid json')
// Expected: System handles gracefully, returns empty array
```

**Test: Missing Talent IDs**
```javascript
// 1. Manually add invalid talent ID to purchased list
// Expected: UI handles gracefully, doesn't crash
```

**Test: Negative LP**
```javascript
// 1. Set LP to negative value
// Expected: System treats as 0 or handles gracefully
```

### 4.2 Parent-Child Relationships

**Test: Circular Dependencies**
```javascript
// Verify no circular parent-child relationships exist in TALENT_TREE
// Expected: No cycles (should be DAG - Directed Acyclic Graph)
```

**Test: Orphaned Talents**
```javascript
// Verify all talents have valid parent references
// Expected: All parent IDs exist in their branch
```

**Test: Missing Position Data**
```javascript
// For grid branches, verify all talents have position data
// Expected: No crashes when rendering
```

### 4.3 Refund Logic Edge Cases

**Test: Refund with Multiple Parents**
```javascript
// 1. Purchase talent with parentsAny requirement (e.g., "predator" needs "fierce" OR "rapid")
// 2. Purchase both parents
// 3. Refund one parent
// Expected: Talent still purchasable (other parent exists)
```

**Test: Refund Branch with Cross-Branch Dependencies**
```javascript
// Verify refundBranch only refunds talents within that branch
// Expected: Cross-branch dependencies don't interfere
```

---

## 5. Automated Testing Suggestions

### 5.1 Unit Test Structure

```javascript
// Example test structure (would need test framework)
describe('Talent System', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  describe('purchaseTalent', () => {
    it('should purchase talent when LP sufficient', () => {
      // Test implementation
    });
    
    it('should fail when LP insufficient', () => {
      // Test implementation
    });
    
    it('should fail when already purchased', () => {
      // Test implementation
    });
  });

  describe('canRefundTalent', () => {
    it('should allow refund when no children', () => {
      // Test implementation
    });
    
    it('should prevent refund when children exist', () => {
      // Test implementation
    });
  });
});
```

### 5.2 Integration Test Scenarios

1. **Full Branch Purchase Flow**: Purchase entire branch, verify all states
2. **Refund Cascade**: Purchase chain, refund root, verify cascade prevention
3. **Cross-Branch Purchase**: Purchase from multiple branches, verify independence
4. **Game State Sync**: Purchase talent, start run, verify effects applied

---

## 6. Manual Testing Checklist

### Quick Smoke Test
- [ ] Open talent tree UI
- [ ] Purchase one tier 1 talent
- [ ] Verify LP decreases
- [ ] Verify talent shows as purchased
- [ ] Refresh page, verify persistence
- [ ] Refund talent, verify LP restored

### Comprehensive Test
- [ ] Test each branch (Warrior, Survivalist, Scavenger, Tinkerer)
- [ ] Test parent requirement logic (parentsAll and parentsAny)
- [ ] Test refund prevention with children
- [ ] Test branch refund functionality
- [ ] Test at least 3-5 gameplay effects (stats, abilities, drops)
- [ ] Test edge cases (corrupted data, missing IDs, etc.)

---

## 7. Debugging Tools

### Browser Console Helpers

```javascript
// Get current purchased talents
JSON.parse(localStorage.getItem('spaceShooter_talents'))

// Get current LP
parseInt(localStorage.getItem('spaceShooter_legacyPoints'))

// Set LP for testing
localStorage.setItem('spaceShooter_legacyPoints', '100')

// Clear all talents
localStorage.removeItem('spaceShooter_talents')

// Manually add talent (for testing)
const talents = JSON.parse(localStorage.getItem('spaceShooter_talents') || '[]')
talents.push('fierce')
localStorage.setItem('spaceShooter_talents', JSON.stringify(talents))

// Check if talent is purchased
JSON.parse(localStorage.getItem('spaceShooter_talents')).includes('fierce')
```

### Visual Inspection Points

1. **Talent Tree UI**:
   - Node colors match state (locked/available/purchased)
   - Connection lines render correctly
   - LP display updates
   - Tooltips show correct information

2. **Game Stats**:
   - Open stats panel during run
   - Verify stat modifiers match purchased talents
   - Check for unexpected stat values

3. **Console Errors**:
   - Watch for JavaScript errors when purchasing/refunding
   - Check for missing DOM elements
   - Verify localStorage operations succeed

---

## 8. Common Issues to Watch For

1. **LP Not Updating**: Check if `addLegacyPoints` is called correctly
2. **Talent Not Purchasable**: Verify parent requirements met and LP sufficient
3. **Refund Not Working**: Check if talent has unpurchased children
4. **Effects Not Applying**: Verify `hasTalent()` checks in game code
5. **UI Not Rendering**: Check if DOM elements exist, verify render function called
6. **State Not Persisting**: Verify localStorage operations, check for JSON parse errors

---

## 9. Performance Considerations

- **Large Talent Trees**: Test with all talents purchased (stress test)
- **Frequent Re-renders**: Verify tree doesn't re-render unnecessarily
- **localStorage Operations**: Check for performance issues with many talents
- **Memory Leaks**: Ensure event listeners cleaned up properly

---

## 10. Regression Tests

After any changes to talent system:
1. Run quick smoke test
2. Test purchase/refund flows
3. Verify game effects still work
4. Check UI rendering
5. Test edge cases that were previously fixed

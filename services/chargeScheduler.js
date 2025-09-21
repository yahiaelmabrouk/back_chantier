const cron = require('node-cron');
const { pool } = require('../config/database');
const Charge = require('../models/Charge');
const PrixOuvrage = require('../models/PrixOuvrage');
const FraisTransportConfig = require('../models/FraisTransportConfig');
const chargesRouter = require('../routes/charges');

// Track the last execution date to prevent multiple runs on the same day
let lastExecutionDate = null;

/**
 * Distributes the daily Prix Ouvrage charges to all active chantiers
 */
async function distributeDailyPrixOuvrageCharges(force = false) {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Check if we already ran today (unless force = true)
  if (!force && lastExecutionDate === today) {
    console.log(`Distribution already ran today (${today}). Skipping.`);
    return { 
      success: false, 
      message: 'Distribution already ran today. Skipping.' 
    };
  }
  
  console.log('Starting daily Prix Ouvrage charge distribution...');
  
  try {
    // Step 1: Get all Prix Ouvrage entries and calculate their total
    const prixOuvrageEntries = await PrixOuvrage.getAll();
    console.log('Prix Ouvrage entries retrieved:', prixOuvrageEntries);
    
    // Check if we have any entries before proceeding
    if (!Array.isArray(prixOuvrageEntries) || prixOuvrageEntries.length === 0) {
      console.log('No Prix Ouvrage entries found.');
      return { success: false, message: 'No Prix Ouvrage entries found' };
    }
    
    const totalMonthlyPrixOuvrage = prixOuvrageEntries.reduce((total, entry) => {
      return total + Number(entry.prix_mois || 0);
    }, 0);
    
    // Calculate daily amount (monthly total / 30 days)
    const dailyPrixOuvrageAmount = totalMonthlyPrixOuvrage / 30;
    
    console.log(`Total monthly Prix Ouvrage: ${totalMonthlyPrixOuvrage}€, Daily amount: ${dailyPrixOuvrageAmount.toFixed(2)}€`);
    
    // If there's no Prix Ouvrage amount, stop
    if (dailyPrixOuvrageAmount <= 0) {
      console.log('No Prix Ouvrage charges to distribute.');
      return { success: false, message: 'No Prix Ouvrage charges to distribute' };
    }
    
    // Step 2: Get all active chantiers
    const [activeChantiers] = await pool.execute(
      'SELECT * FROM chantiers WHERE etat = ?', 
      ['en cours']
    );
    
    console.log(`Found ${activeChantiers.length} active chantiers`);
    
    // If there are no active chantiers, stop
    if (!activeChantiers.length) {
      console.log('No active chantiers to distribute charges to.');
      return { success: false, message: 'No active chantiers to distribute charges to' };
    }
    
    // Step 3: Calculate amount per chantier
    const amountPerChantier = dailyPrixOuvrageAmount / activeChantiers.length;
    
    console.log(`Distributing ${amountPerChantier.toFixed(2)}€ to each active chantier`);
    
    // Step 4: Create a charge for each active chantier
    const createdCharges = [];
    
    for (const chantier of activeChantiers) {
      const chargeData = {
        chantierId: chantier.id,
        type: 'Charges fixes',
        name: 'Prix Ouvrage (distribution quotidienne)',
        budget: amountPerChantier,
        montant: amountPerChantier,
        description: `Distribution automatique des charges Prix Ouvrage pour le ${today}. Montant mensuel total: ${totalMonthlyPrixOuvrage.toFixed(2)}€, réparti sur ${activeChantiers.length} chantier(s).`,
        date: today
      };
      
      try {
        const createdCharge = await Charge.createCharge(chargeData);
        console.log(`Created charge for chantier ${chantier.id}: ${JSON.stringify(createdCharge)}`);
        createdCharges.push(createdCharge);
      } catch (error) {
        console.error(`Failed to create charge for chantier ${chantier.id}:`, error);
      }
    }
    
    console.log('Daily Prix Ouvrage charge distribution completed successfully!');
    
    // Update the last execution date to prevent multiple runs on the same day
    lastExecutionDate = today;
    
    return {
      success: true,
      message: `Created ${createdCharges.length} charges successfully`,
      charges: createdCharges
    };
  } catch (error) {
    console.error('Error distributing daily Prix Ouvrage charges:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Applies the daily transport fees charges to appropriate chantiers
 */
async function applyDailyTransportFees(force = false) {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Check if we already ran today (unless force = true)
  if (!force && lastExecutionDate === today) {
    console.log(`Transport fees already applied today (${today}). Skipping.`);
    return { 
      success: false, 
      message: 'Transport fees already applied today. Skipping.' 
    };
  }
  
  console.log('Starting daily transport fees application...');
  
  try {
    if (typeof chargesRouter.applyTransportFees !== 'function') {
      console.error('Transport fees handler not available');
      return { success: false, message: 'Transport fees handler not available' };
    }
    
    // Create a mock request and response to use the existing handler
    const req = { 
      params: { date: today },
      body: { date: today }
    };
    
    let responseData = null;
    const res = {
      json: (data) => { responseData = data; },
      status: (code) => ({
        json: (data) => { responseData = { ...data, statusCode: code }; }
      })
    };
    
    // Call the handler
    await chargesRouter.applyTransportFees(req, res);
    
    console.log('Daily transport fees application result:', responseData);
    
    return responseData || { success: false, message: 'No response from handler' };
  } catch (error) {
    console.error('Error applying daily transport fees:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initializes the scheduler for daily Prix Ouvrage charge distribution
 */
function initChargeScheduler() {
  // FIXED: Correct cron syntax for 5:16 AM (minute hour * * *)
  // The order is: minute hour day-of-month month day-of-week
  cron.schedule('0 0 * * *', async () => {
    const now = new Date();
    console.log(`Cron job triggered at ${now.toISOString()}`);
    console.log('Running scheduled daily Prix Ouvrage charge distribution task');
    try {
      const result = await distributeDailyPrixOuvrageCharges();
      console.log('Scheduled distribution result:', result);
      
      // Also apply transport fees
      console.log('Running scheduled daily transport fees application task');
      const transportResult = await applyDailyTransportFees();
      console.log('Scheduled transport fees result:', transportResult);
    } catch (error) {
      console.error('Error in scheduled tasks:', error);
    }
  });
  
  console.log('Charge scheduler initialized - will run at midnight daily');
  
  // Add a immediate test option that can be controlled via environment variable
  if (process.env.TEST_DISTRIBUTION === 'true') {
    console.log('TEST_DISTRIBUTION is enabled - running distribution in 5 seconds');
    setTimeout(async () => {
      try {
        console.log('Running test distribution...');
        const result = await distributeDailyPrixOuvrageCharges(true);
        console.log('Test distribution result:', result);
        
        // Also test transport fees
        console.log('Running test transport fees application...');
        const transportResult = await applyDailyTransportFees(true);
        console.log('Test transport fees result:', transportResult);
      } catch (error) {
        console.error('Error in test tasks:', error);
      }
    }, 5000);
  }
}

module.exports = {
  initChargeScheduler,
  distributeDailyPrixOuvrageCharges, // Export for manual triggering or testing
  applyDailyTransportFees // Export for manual triggering or testing
};


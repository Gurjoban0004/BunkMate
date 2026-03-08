const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * Scheduled function to cleanup old semester data
 * Runs every 24 hours
 */
exports.cleanupOldSemesters = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
  
  console.log(`🧹 Starting cleanup for data older than ${sixMonthsAgo.toISOString()}`);
  
  try {
    const usersSnap = await db.collection('users').get();
    let deletedCount = 0;
    
    for (const userDoc of usersSnap.docs) {
      const semestersSnap = await userDoc.ref.collection('semesters')
        .where('setupDate', '<', sixMonthsAgo.toISOString())
        .get();
        
      for (const semesterDoc of semestersSnap.docs) {
        try {
          await semesterDoc.ref.delete();
          deletedCount++;
        } catch (err) {
          console.error(`❌ Failed to delete semester ${semesterDoc.id} for user ${userDoc.id}:`, err);
          // Continue with next semester
        }
      }
    }
    
    console.log(`✅ Cleanup complete. Deleted ${deletedCount} semester documents.`);
    return null;
  } catch (error) {
    console.error('❌ Critical error in cleanupOldSemesters:', error);
    return null;
  }
});

/**
 * Scheduled function to warn users before data deletion
 * Runs every 24 hours
 */
exports.warnBeforeDeletion = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = new Date();
  const fiveMonthsAgo = new Date(now.setMonth(now.getMonth() - 5));
  const sixMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 6));
  
  console.log(`⚠️ Checking for semesters older than 5 months (setup before ${fiveMonthsAgo.toISOString()})`);
  
  try {
    const usersSnap = await db.collection('users').get();
    let warnedCount = 0;
    
    for (const userDoc of usersSnap.docs) {
      const semestersSnap = await userDoc.ref.collection('semesters')
        .where('setupDate', '<', fiveMonthsAgo.toISOString())
        .where('deletionWarned', '==', false) // Use false if it was initialized, or check undefined
        .get();
        
      for (const semesterDoc of semestersSnap.docs) {
        const data = semesterDoc.data();
        
        // Skip if already deleted or warned
        if (data._deleted || data.deletionWarned) continue;
        
        try {
          const setupDate = new Date(data.setupDate);
          const deletionDate = new Date(setupDate.setMonth(setupDate.getMonth() + 6));
          const daysUntilDeletion = Math.ceil((deletionDate - new Date()) / (1000 * 60 * 60 * 24));
          
          await semesterDoc.ref.update({
            deletionWarned: true,
            deletionDate: deletionDate.toISOString(),
            daysUntilDeletion: daysUntilDeletion,
            lastWarnedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          warnedCount++;
        } catch (err) {
          console.error(`❌ Failed to warn user for semester ${semesterDoc.id}:`, err);
        }
      }
    }
    
    console.log(`✅ Warning process complete. Warned ${warnedCount} users.`);
    return null;
  } catch (error) {
    console.error('❌ Critical error in warnBeforeDeletion:', error);
    return null;
  }
});

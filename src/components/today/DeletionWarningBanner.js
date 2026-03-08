import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useApp } from '../../context/AppContext';
import { getCurrentSemesterId } from '../../utils/firebaseHelpers';
import { Typography } from '../common/Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme/theme';
import { logger } from '../../utils/logger';

export default function DeletionWarningBanner() {
  const [warningData, setWarningData] = useState(null);
  const { userId } = useApp();
  const navigation = useNavigation();

  useEffect(() => {
    const fetchWarningStatus = async () => {
      if (!userId) return;

      try {
        const semesterId = getCurrentSemesterId();
        const semesterRef = doc(db, 'users', userId, 'semesters', semesterId);
        const docSnap = await getDoc(semesterRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.deletionWarned && data.daysUntilDeletion <= 30) {
            setWarningData({
              daysRemaining: data.daysUntilDeletion,
              deletionDate: data.deletionDate ? new Date(data.deletionDate).toLocaleDateString() : 'soon'
            });
          }
        }
      } catch (error) {
        logger.warn('⚠️ Error fetching deletion warning:', error);
      }
    };

    fetchWarningStatus();
  }, [userId]);

  if (!warningData) return null;

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => navigation.navigate('Settings')}
    >
      <View style={styles.content}>
        <Typography variant="h3" style={styles.title}>
          ⚠️ Data Deletion Warning
        </Typography>
        <Typography variant="body2" style={styles.message}>
          This semester's data will be deleted in {warningData.daysRemaining} days ({warningData.deletionDate}).
        </Typography>
        <Typography variant="caption" style={styles.reminder}>
          Please export your data from Settings if you wish to keep it.
        </Typography>
        <View style={styles.button}>
          <Typography variant="label" style={styles.buttonText}>
            GO TO SETTINGS →
          </Typography>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBE6', // Light warning yellow
    borderWidth: 1,
    borderColor: '#FFE58F', // Border warning yellow
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }
    })
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: '#856404', // Dark warning brown
    marginBottom: 4,
  },
  message: {
    color: '#856404',
    textAlign: 'center',
    marginBottom: 4,
  },
  reminder: {
    color: '#856404',
    opacity: 0.8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#856404',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
  }
});

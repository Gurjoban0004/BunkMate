import React from 'react';
import { Platform, View, Text, TouchableOpacity, TextInput } from 'react-native';

let DateTimePicker = null;
if (Platform.OS !== 'web') {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
}

export default function PlatformDatePicker({ date, onDateChange, minimumDate }) {
    const [show, setShow] = React.useState(false);

    if (Platform.OS === 'web') {
        return (
            <input
                type="date"
                value={date ? date.toISOString().split('T')[0] : ''}
                min={minimumDate ? minimumDate.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                    if (e.target.value) {
                        onDateChange(new Date(e.target.value));
                    } else {
                        onDateChange(null);
                    }
                }}
                style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    backgroundColor: '#f8f9fa'
                }}
            />
        );
    }

    return (
        <View>
            <TouchableOpacity onPress={() => setShow(true)} style={{ padding: 8, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
                <Text style={{ fontSize: 16 }}>
                    {date ? date.toLocaleDateString() : 'Select Date'}
                </Text>
            </TouchableOpacity>
            {show && (
                <DateTimePicker
                    value={date || new Date()}
                    mode="date"
                    display="default"
                    minimumDate={minimumDate}
                    onChange={(event, selectedDate) => {
                        setShow(false);
                        if (selectedDate) {
                            onDateChange(selectedDate);
                        }
                    }}
                />
            )}
        </View>
    );
}

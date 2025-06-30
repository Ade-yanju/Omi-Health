// components/AnimatedModal.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Modal from "react-native-modal";

const AnimatedModal = ({ visible, message, success, onClose }) => {
  return (
    <Modal isVisible={visible}>
      <View
        style={[
          styles.modalContent,
          { backgroundColor: success ? "#C8E6C9" : "#FFCDD2" },
        ]}
      >
        <Text
          style={[styles.modalText, { color: success ? "#2E7D32" : "#C62828" }]}
        >
          {message}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.button}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  modalText: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  button: {
    marginTop: 15,
    backgroundColor: "#00796b",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});

export default AnimatedModal;

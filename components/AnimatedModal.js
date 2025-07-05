// AnimatedModal.js
import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";

const AnimatedModal = ({
  visible,
  message,
  type = "error",
  onClose,
  onConfirm,
}) => {
  const backgroundColor =
    type === "success" ? "#4CAF50" : type === "confirm" ? "#FFC107" : "#F44336";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { borderColor: backgroundColor }]}>
          <Text style={[styles.message, { color: backgroundColor }]}>
            {message}
          </Text>

          {type === "confirm" ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.button} onPress={onConfirm}>
                <Text style={[styles.buttonText, { color: "#4CAF50" }]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={onClose}>
                <Text style={[styles.buttonText, { color: "#F44336" }]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
  },
  message: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  closeButton: {
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default AnimatedModal;

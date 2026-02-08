package rsvppin

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"time"
)

const rotationHours = 3

// GetCurrentPIN returns the 6-digit PIN for the current 3-hour window.
func GetCurrentPIN(secret string) string {
	return getPINForTime(secret, time.Now())
}

// getPINForTime returns the 6-digit PIN for the 3-hour window containing t.
func getPINForTime(secret string, t time.Time) string {
	window := t.Unix() / (rotationHours * 3600)
	h := sha256.New()
	h.Write([]byte(secret))
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(window))
	h.Write(buf)
	sum := h.Sum(nil)
	// Use first 4 bytes to get a number 0..999999
	n := binary.BigEndian.Uint32(sum) % 1000000
	return fmt.Sprintf("%06d", n)
}

// ValidatePIN checks if the provided PIN matches the current window's PIN.
func ValidatePIN(secret, pin string) bool {
	if len(pin) != 6 {
		return false
	}
	current := GetCurrentPIN(secret)
	return pin == current
}

// GetNextRotationTime returns the time when the PIN will next change.
func GetNextRotationTime() time.Time {
	now := time.Now()
	windowSec := int64(rotationHours * 3600)
	elapsed := now.Unix() % windowSec
	next := now.Unix() + (windowSec - elapsed)
	return time.Unix(next, 0)
}

// GetSecondsUntilRotation returns seconds until next PIN rotation.
func GetSecondsUntilRotation() int64 {
	return GetNextRotationTime().Unix() - time.Now().Unix()
}

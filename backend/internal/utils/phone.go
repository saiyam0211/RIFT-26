package utils

import "fmt"

// MaskPhone masks a phone number showing only last 4 digits
func MaskPhone(phone string) string {
	if len(phone) < 4 {
		return "****"
	}
	lastFour := phone[len(phone)-4:]
	return fmt.Sprintf("******%s", lastFour)
}

// FormatPhone formats a 10-digit phone number for India
func FormatPhone(phone string) string {
	if len(phone) != 10 {
		return phone
	}
	return fmt.Sprintf("+91-%s-%s-%s", phone[0:5], phone[5:8], phone[8:10])
}

// ValidatePhone checks if a phone number is valid (10 digits)
func ValidatePhone(phone string) bool {
	if len(phone) != 10 {
		return false
	}
	for _, char := range phone {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

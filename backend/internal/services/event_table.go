package services

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
)

type EventTableService struct {
	repo *repository.EventTableRepository
}

func NewEventTableService(repo *repository.EventTableRepository) *EventTableService {
	return &EventTableService{repo: repo}
}

// CreateEventTable creates a new event table
func (s *EventTableService) CreateEventTable(req *models.CreateEventTableRequest) (*models.EventTable, error) {
	// Validate request
	if req.TableName == "" {
		return nil, fmt.Errorf("table name is required")
	}
	if req.TableNumber == "" {
		return nil, fmt.Errorf("table number is required")
	}
	if req.City == "" {
		return nil, fmt.Errorf("city is required")
	}

	table := &models.EventTable{
		TableName:   req.TableName,
		TableNumber: req.TableNumber,
		City:        req.City,
		Capacity:    req.Capacity,
		IsActive:    true, // Default to active
	}

	err := s.repo.Create(table)
	if err != nil {
		return nil, err
	}

	return table, nil
}

// GetEventTable retrieves an event table by ID
func (s *EventTableService) GetEventTable(id uuid.UUID) (*models.EventTable, error) {
	return s.repo.GetByID(id)
}

// GetAllEventTables retrieves all event tables with optional filters
func (s *EventTableService) GetAllEventTables(city *string, isActive *bool) ([]models.EventTable, error) {
	return s.repo.GetAll(city, isActive)
}

// UpdateEventTable updates an event table
func (s *EventTableService) UpdateEventTable(id uuid.UUID, req *models.UpdateEventTableRequest) (*models.EventTable, error) {
	// Get existing table
	table, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	// Update fields if provided (non-empty values)
	if req.TableName != "" {
		table.TableName = req.TableName
	}
	if req.Capacity > 0 {
		table.Capacity = req.Capacity
	}
	if req.IsActive != nil {
		table.IsActive = *req.IsActive
	}

	err = s.repo.Update(table)
	if err != nil {
		return nil, err
	}

	return table, nil
}

// DeleteEventTable deletes an event table
func (s *EventTableService) DeleteEventTable(id uuid.UUID) error {
	return s.repo.Delete(id)
}

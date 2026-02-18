package services

import (
	"context"
	"fmt"

	"github.com/rift26/backend/internal/models"
	"github.com/rift26/backend/internal/repository"
)

// RegistrationDeskAllocationService allocates event_tables (registration desks) to teams by city.
// Teams in a city are distributed evenly across that city's desks.
type RegistrationDeskAllocationService struct {
	teamRepo       *repository.TeamRepository
	eventTableRepo *repository.EventTableRepository
}

func NewRegistrationDeskAllocationService(teamRepo *repository.TeamRepository, eventTableRepo *repository.EventTableRepository) *RegistrationDeskAllocationService {
	return &RegistrationDeskAllocationService{teamRepo: teamRepo, eventTableRepo: eventTableRepo}
}

// CityAllocationResult is the result of allocating desks for one city.
type CityAllocationResult struct {
	City          string `json:"city"`
	TeamsCount    int    `json:"teams_count"`
	TablesCount   int    `json:"tables_count"`
	TeamsAllocated int   `json:"teams_allocated"`
}

// AllocateResult is the result of running allocation for all cities.
type AllocateResult struct {
	ByCity []CityAllocationResult `json:"by_city"`
}

var allocationCities = []string{string(models.CityBLR), string(models.CityPUNE), string(models.CityNOIDA), string(models.CityLKO)}

// AllocateRegistrationDesks assigns each rsvp2_done team to a registration desk in its city.
// Previous allocations (for rsvp2_done teams) are cleared before assigning. Teams are distributed round-robin.
func (s *RegistrationDeskAllocationService) AllocateRegistrationDesks(ctx context.Context) (*AllocateResult, error) {
	// Clear previous registration desk allocations for all rsvp2_done teams
	_, err := s.teamRepo.ClearRegistrationDesksForRSVP2Teams(ctx)
	if err != nil {
		return nil, fmt.Errorf("clear previous allocations: %w", err)
	}

	result := &AllocateResult{ByCity: make([]CityAllocationResult, 0, len(allocationCities))}

	for _, city := range allocationCities {
		teamIDs, err := s.teamRepo.GetTeamIDsByCity(ctx, city)
		if err != nil {
			return nil, fmt.Errorf("get teams for city %s: %w", city, err)
		}
		isActive := true
		tables, err := s.eventTableRepo.GetAll(&city, &isActive)
		if err != nil {
			return nil, fmt.Errorf("get event tables for city %s: %w", city, err)
		}

		res := CityAllocationResult{City: city, TeamsCount: len(teamIDs), TablesCount: len(tables)}
		if len(tables) == 0 {
			result.ByCity = append(result.ByCity, res)
			continue
		}

		for i, teamID := range teamIDs {
			deskIdx := i % len(tables)
			if err := s.teamRepo.SetRegistrationDesk(ctx, teamID, tables[deskIdx].ID); err != nil {
				return nil, fmt.Errorf("set registration desk for team %s: %w", teamID, err)
			}
			res.TeamsAllocated++
		}
		result.ByCity = append(result.ByCity, res)
	}

	return result, nil
}

// ClearAllRegistrationDesks clears registration_desk_id for all teams that have one set.
func (s *RegistrationDeskAllocationService) ClearAllRegistrationDesks(ctx context.Context) (int64, error) {
	return s.teamRepo.ClearAllRegistrationDesks(ctx)
}

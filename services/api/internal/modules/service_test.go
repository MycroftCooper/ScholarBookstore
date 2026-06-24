package modules

import (
	"context"
	"errors"
	"testing"
)

type fakeModuleRepo struct {
	listed  []Module
	created CreateModuleInput
	updated UpdateModuleInput
}

func (r *fakeModuleRepo) List(_ context.Context, _ bool) ([]Module, error) {
	return r.listed, nil
}

func (r *fakeModuleRepo) FindBySlug(_ context.Context, slug string) (Module, error) {
	if slug != "database" {
		return Module{}, ErrNotFound
	}
	return Module{ID: 1, DomainID: 1, DomainSlug: "backend", DomainName: "后端开发", Slug: slug, Name: "数据库", IsActive: true}, nil
}

func (r *fakeModuleRepo) Create(_ context.Context, input CreateModuleInput) (Module, error) {
	r.created = input
	return Module{
		ID:          1,
		DomainID:    input.DomainID,
		DomainSlug:  "backend",
		DomainName:  "后端开发",
		Slug:        input.Slug,
		Name:        input.Name,
		Description: input.Description,
		SortOrder:   input.SortOrder,
		IsActive:    input.IsActive,
	}, nil
}

func (r *fakeModuleRepo) Update(_ context.Context, id int64, input UpdateModuleInput) (Module, error) {
	if id != 1 {
		return Module{}, ErrNotFound
	}
	r.updated = input
	name := "数据库"
	if input.Name != nil {
		name = *input.Name
	}
	return Module{ID: id, DomainID: 1, DomainSlug: "backend", DomainName: "后端开发", Slug: "database", Name: name, IsActive: true}, nil
}

func (r *fakeModuleRepo) Delete(_ context.Context, id int64) error {
	if id != 1 {
		return ErrNotFound
	}
	return nil
}

func (r *fakeModuleRepo) FindByID(_ context.Context, id int64) (Module, error) {
	if id != 1 {
		return Module{}, ErrNotFound
	}
	return Module{ID: id, DomainID: 1, DomainSlug: "backend", DomainName: "后端开发", Slug: "database", Name: "数据库", IsActive: true}, nil
}

func (r *fakeModuleRepo) CanManageDomain(_ context.Context, _ int64, _ string, _ int64) (bool, error) {
	return true, nil
}

func (r *fakeModuleRepo) CanManageModule(_ context.Context, _ int64, _ string, _ int64) (bool, error) {
	return true, nil
}

func (r *fakeModuleRepo) AddModerator(_ context.Context, moduleID int64, userID int64) (ModuleModerator, error) {
	return ModuleModerator{ModuleID: moduleID, UserID: userID}, nil
}

func (r *fakeModuleRepo) RemoveModerator(_ context.Context, _ int64, _ int64) error {
	return nil
}

func TestCreateNormalizesAndValidatesInput(t *testing.T) {
	repo := &fakeModuleRepo{}
	service := NewService(repo)

	module, err := service.Create(context.Background(), CreateModuleInput{
		DomainID:    1,
		Slug:        " Database ",
		Name:        " 数据库 ",
		Description: " PostgreSQL 与存储 ",
		SortOrder:   10,
		IsActive:    true,
	})
	if err != nil {
		t.Fatalf("create module: %v", err)
	}

	if module.Slug != "database" || module.Name != "数据库" || module.Description != "PostgreSQL 与存储" {
		t.Fatalf("unexpected normalized module: %#v", module)
	}
}

func TestCreateRejectsInvalidSlug(t *testing.T) {
	service := NewService(&fakeModuleRepo{})
	_, err := service.Create(context.Background(), CreateModuleInput{
		DomainID: 1,
		Slug:     "bad slug",
		Name:     "数据库",
		IsActive: true,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestFindBySlugRejectsInvalidSlugAsNotFound(t *testing.T) {
	service := NewService(&fakeModuleRepo{})
	_, err := service.FindBySlug(context.Background(), "../database")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestUpdateTrimsName(t *testing.T) {
	repo := &fakeModuleRepo{}
	service := NewService(repo)
	name := " 数据库 "

	module, err := service.Update(context.Background(), 1, UpdateModuleInput{Name: &name})
	if err != nil {
		t.Fatalf("update module: %v", err)
	}

	if module.Name != "数据库" || repo.updated.Name == nil || *repo.updated.Name != "数据库" {
		t.Fatalf("name was not trimmed: module=%#v updated=%#v", module, repo.updated.Name)
	}
}

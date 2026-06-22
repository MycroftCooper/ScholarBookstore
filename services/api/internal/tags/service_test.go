package tags

import (
	"context"
	"errors"
	"testing"
)

type fakeTagRepo struct {
	updated UpdateInput
	merged  MergeInput
}

func (r *fakeTagRepo) List(_ context.Context, filter Filter, page int, pageSize int) ([]Tag, int64, error) {
	return []Tag{{ID: 1, Name: filter.Query, Slug: "go", UsageCount: 2}}, 1, nil
}

func (r *fakeTagRepo) Update(_ context.Context, id int64, input UpdateInput) (Tag, error) {
	r.updated = input
	return Tag{ID: id, Name: input.Name, Slug: tagSlug(input.Name), UsageCount: 1}, nil
}

func (r *fakeTagRepo) Delete(_ context.Context, id int64) error {
	if id != 1 {
		return ErrNotFound
	}
	return nil
}

func (r *fakeTagRepo) Merge(_ context.Context, input MergeInput) (Tag, error) {
	r.merged = input
	return Tag{ID: input.TargetID, Name: "Go", Slug: "go", UsageCount: 3}, nil
}

func TestUpdateRejectsInvalidName(t *testing.T) {
	service := NewService(&fakeTagRepo{})

	_, err := service.Update(context.Background(), 1, UpdateInput{Name: "   "})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestUpdateNormalizesName(t *testing.T) {
	repo := &fakeTagRepo{}
	service := NewService(repo)

	tag, err := service.Update(context.Background(), 1, UpdateInput{Name: " Go "})
	if err != nil {
		t.Fatalf("update tag: %v", err)
	}
	if tag.Name != "Go" || repo.updated.Name != "Go" {
		t.Fatalf("name was not trimmed: tag=%#v input=%#v", tag, repo.updated)
	}
}

func TestMergeRejectsTargetOnly(t *testing.T) {
	service := NewService(&fakeTagRepo{})

	_, err := service.Merge(context.Background(), MergeInput{TargetID: 1, SourceIDs: []int64{1}})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestMergeDeduplicatesSources(t *testing.T) {
	repo := &fakeTagRepo{}
	service := NewService(repo)

	_, err := service.Merge(context.Background(), MergeInput{TargetID: 1, SourceIDs: []int64{2, 2, 3}})
	if err != nil {
		t.Fatalf("merge tags: %v", err)
	}
	if len(repo.merged.SourceIDs) != 2 || repo.merged.SourceIDs[0] != 2 || repo.merged.SourceIDs[1] != 3 {
		t.Fatalf("sources were not deduplicated: %#v", repo.merged.SourceIDs)
	}
}

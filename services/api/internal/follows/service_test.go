package follows

import (
	"context"
	"errors"
	"testing"
)

type fakeFollowRepo struct {
	followerID int64
	viewerID   int64
	userID     int64
	username   string
}

func (r *fakeFollowRepo) Follow(_ context.Context, followerID int64, username string) (State, error) {
	r.followerID = followerID
	r.username = username
	return State{Username: username, Following: true, FollowersCount: 1}, nil
}

func (r *fakeFollowRepo) Unfollow(_ context.Context, followerID int64, username string) (State, error) {
	r.followerID = followerID
	r.username = username
	return State{Username: username, Following: false, FollowersCount: 0}, nil
}

func (r *fakeFollowRepo) State(_ context.Context, viewerID int64, username string) (State, error) {
	r.viewerID = viewerID
	r.username = username
	return State{Username: username, Following: true, FollowersCount: 2}, nil
}

func (r *fakeFollowRepo) ListFollowing(_ context.Context, userID int64) ([]UserSummary, error) {
	r.userID = userID
	return []UserSummary{{ID: 2, Username: "target"}}, nil
}

func (r *fakeFollowRepo) ListFollowers(_ context.Context, userID int64) ([]UserSummary, error) {
	r.userID = userID
	return []UserSummary{{ID: 3, Username: "follower"}}, nil
}

func (r *fakeFollowRepo) ListRecommendedUsers(_ context.Context, userID int64, _ int) ([]UserSummary, error) {
	r.userID = userID
	return []UserSummary{{ID: 4, Username: "recommended", PublishedArticleCount: 3, FollowersCount: 2}}, nil
}

func (r *fakeFollowRepo) FollowModule(_ context.Context, followerID int64, slug string) (TargetState, error) {
	r.followerID = followerID
	return TargetState{Slug: slug, Following: true}, nil
}

func (r *fakeFollowRepo) UnfollowModule(_ context.Context, followerID int64, slug string) (TargetState, error) {
	r.followerID = followerID
	return TargetState{Slug: slug, Following: false}, nil
}

func (r *fakeFollowRepo) ModuleState(_ context.Context, viewerID int64, slug string) (TargetState, error) {
	r.viewerID = viewerID
	return TargetState{Slug: slug, Following: true}, nil
}

func (r *fakeFollowRepo) FollowDomain(_ context.Context, followerID int64, id int64) (TargetState, error) {
	r.followerID = followerID
	return TargetState{ID: id, Following: true}, nil
}

func (r *fakeFollowRepo) UnfollowDomain(_ context.Context, followerID int64, id int64) (TargetState, error) {
	r.followerID = followerID
	return TargetState{ID: id, Following: false}, nil
}

func (r *fakeFollowRepo) DomainState(_ context.Context, viewerID int64, id int64) (TargetState, error) {
	r.viewerID = viewerID
	return TargetState{ID: id, Following: true}, nil
}

func (r *fakeFollowRepo) ListFollowingModules(_ context.Context, userID int64) ([]ModuleSummary, error) {
	r.userID = userID
	return []ModuleSummary{{ID: 1, Slug: "database"}}, nil
}

func (r *fakeFollowRepo) ListFollowingDomains(_ context.Context, userID int64) ([]DomainSummary, error) {
	r.userID = userID
	return []DomainSummary{{ID: 1, Slug: "backend"}}, nil
}

func TestFollowTrimsUsernameAndForwardsFollower(t *testing.T) {
	repo := &fakeFollowRepo{}
	service := NewService(repo)

	state, err := service.Follow(context.Background(), 7, " target ")
	if err != nil {
		t.Fatalf("follow: %v", err)
	}
	if repo.followerID != 7 || repo.username != "target" || !state.Following {
		t.Fatalf("unexpected follow result: repo=%#v state=%#v", repo, state)
	}
}

func TestFollowRejectsInvalidInput(t *testing.T) {
	service := NewService(&fakeFollowRepo{})

	if _, err := service.Follow(context.Background(), 0, "target"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("Follow error = %v, want ErrInvalidInput", err)
	}
	if _, err := service.State(context.Background(), 1, " "); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("State error = %v, want ErrInvalidInput", err)
	}
}

func TestFollowListsRequireAuthenticatedUser(t *testing.T) {
	service := NewService(&fakeFollowRepo{})

	if _, err := service.ListFollowing(context.Background(), 0); !errors.Is(err, ErrForbidden) {
		t.Fatalf("ListFollowing error = %v, want ErrForbidden", err)
	}
	if _, err := service.ListFollowers(context.Background(), 0); !errors.Is(err, ErrForbidden) {
		t.Fatalf("ListFollowers error = %v, want ErrForbidden", err)
	}
	if _, err := service.ListRecommendedUsers(context.Background(), 0, 6); !errors.Is(err, ErrForbidden) {
		t.Fatalf("ListRecommendedUsers error = %v, want ErrForbidden", err)
	}
}

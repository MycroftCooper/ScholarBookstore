package dashboard

import "context"

type RepositoryInterface interface {
	Snapshot(ctx context.Context) (Dashboard, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Snapshot(ctx context.Context) (Dashboard, error) {
	return s.repo.Snapshot(ctx)
}

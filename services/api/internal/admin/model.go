package admin

import "time"

type Task struct {
	ID              int64
	TaskType        string
	ObjectType      string
	ObjectID        int64
	DomainID        *int64
	DomainName      *string
	ModuleID        *int64
	ModuleName      *string
	Title           string
	Summary         string
	Status          string
	Priority        int
	SubmitterID     *int64
	SubmitterName   *string
	AssigneeID      *int64
	AssigneeName    *string
	DueAt           *time.Time
	ResolvedAt      *time.Time
	Resolution      string
	ResolutionNote  string
	ObjectTitle     *string
	ObjectStatus    *string
	ObjectContentMD *string
	TargetUserID    *int64
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type PublicTask struct {
	ID              int64      `json:"id"`
	TaskType        string     `json:"taskType"`
	ObjectType      string     `json:"objectType"`
	ObjectID        int64      `json:"objectId"`
	DomainID        *int64     `json:"domainId"`
	DomainName      *string    `json:"domainName"`
	ModuleID        *int64     `json:"moduleId"`
	ModuleName      *string    `json:"moduleName"`
	Title           string     `json:"title"`
	Summary         string     `json:"summary"`
	Status          string     `json:"status"`
	Priority        int        `json:"priority"`
	SubmitterID     *int64     `json:"submitterId"`
	SubmitterName   *string    `json:"submitterName"`
	AssigneeID      *int64     `json:"assigneeId"`
	AssigneeName    *string    `json:"assigneeName"`
	DueAt           *time.Time `json:"dueAt"`
	ResolvedAt      *time.Time `json:"resolvedAt"`
	Resolution      string     `json:"resolution"`
	ResolutionNote  string     `json:"resolutionNote"`
	ObjectTitle     *string    `json:"objectTitle,omitempty"`
	ObjectStatus    *string    `json:"objectStatus,omitempty"`
	ObjectContentMD *string    `json:"objectContentMd,omitempty"`
	TargetUserID    *int64     `json:"targetUserId,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type TaskFilter struct {
	TaskType   string
	Status     string
	Priority   *int
	DomainID   *int64
	ModuleID   *int64
	AssigneeID *int64
	ActorID    int64
	ActorRole  string
}

type Page struct {
	Number int
	Size   int
	Total  int64
	Tasks  []PublicTask
}

type TaskStats struct {
	MyPending      int64 `json:"myPending"`
	PendingReviews int64 `json:"pendingReviews"`
	PendingReports int64 `json:"pendingReports"`
	OverdueTasks   int64 `json:"overdueTasks"`
	ResolvedToday  int64 `json:"resolvedToday"`
}

type AuditLogInput struct {
	ActorID    int64
	Action     string
	TargetType string
	TargetID   int64
	DomainID   *int64
	ModuleID   *int64
	Detail     map[string]string
	IP         string
	UserAgent  string
}

type AuditLog struct {
	ID         int64             `json:"id"`
	ActorID    *int64            `json:"actorId"`
	ActorName  *string           `json:"actorName"`
	Action     string            `json:"action"`
	TargetType string            `json:"targetType"`
	TargetID   int64             `json:"targetId"`
	DomainID   *int64            `json:"domainId"`
	DomainName *string           `json:"domainName"`
	ModuleID   *int64            `json:"moduleId"`
	ModuleName *string           `json:"moduleName"`
	Detail     map[string]string `json:"detail"`
	IP         string            `json:"ip"`
	UserAgent  string            `json:"userAgent"`
	CreatedAt  time.Time         `json:"createdAt"`
}

type AuditLogFilter struct {
	Action     string
	ActorID    *int64
	TargetType string
	TargetID   *int64
	DomainID   *int64
	ModuleID   *int64
}

type AuditLogPage struct {
	Number int
	Size   int
	Total  int64
	Logs   []AuditLog
}

func ToPublicTask(item Task, includeObjectContent bool) PublicTask {
	out := PublicTask{
		ID:             item.ID,
		TaskType:       item.TaskType,
		ObjectType:     item.ObjectType,
		ObjectID:       item.ObjectID,
		DomainID:       item.DomainID,
		DomainName:     item.DomainName,
		ModuleID:       item.ModuleID,
		ModuleName:     item.ModuleName,
		Title:          item.Title,
		Summary:        item.Summary,
		Status:         item.Status,
		Priority:       item.Priority,
		SubmitterID:    item.SubmitterID,
		SubmitterName:  item.SubmitterName,
		AssigneeID:     item.AssigneeID,
		AssigneeName:   item.AssigneeName,
		DueAt:          item.DueAt,
		ResolvedAt:     item.ResolvedAt,
		Resolution:     item.Resolution,
		ResolutionNote: item.ResolutionNote,
		ObjectTitle:    item.ObjectTitle,
		ObjectStatus:   item.ObjectStatus,
		TargetUserID:   item.TargetUserID,
		CreatedAt:      item.CreatedAt,
		UpdatedAt:      item.UpdatedAt,
	}
	if includeObjectContent {
		out.ObjectContentMD = item.ObjectContentMD
	}
	return out
}

func ToPublicTasks(items []Task) []PublicTask {
	out := make([]PublicTask, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublicTask(item, false))
	}
	return out
}

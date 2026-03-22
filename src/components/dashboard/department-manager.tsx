"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus, X, FolderPlus, GripVertical, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDepartmentMember, removeDepartmentMember, createDepartment } from "@/lib/actions";
import type { Department } from "@/lib/types";

interface Member {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface Props {
  companyId: string;
  departments: Department[];
  membersByDept: Record<string, string[]>;
  unassignedUserIds: string[];
  allMembers: Member[];
  canManage: boolean;
}

// Draggable user chip
function DraggableUser({ member, canDrag }: { member: Member; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `user-${member.id}`,
    data: { userId: member.id },
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm",
        isDragging && "opacity-30",
        canDrag && "cursor-grab active:cursor-grabbing"
      )}
      {...listeners}
      {...attributes}
    >
      {canDrag && <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />}
      <span className="truncate">{member.fullName || member.email || "Unnamed"}</span>
    </div>
  );
}

// Drop zone for a department
function DepartmentDropZone({
  department,
  members,
  allMembers,
  children,
  isSelected,
  onSelect,
  onRemoveMember,
  onCreateSub,
  canManage,
  isExpanded,
  onToggle,
  hasChildren,
  depth,
}: {
  department: Department | null; // null = unassigned
  members: string[];
  allMembers: Member[];
  children?: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  onRemoveMember: (userId: string, deptMembershipId?: string) => void;
  onCreateSub?: () => void;
  canManage: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  hasChildren?: boolean;
  depth: number;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: department ? `dept-${department.id}` : "unassigned",
    data: { departmentId: department?.id ?? null },
  });

  const memberObjects = members
    .map((id) => allMembers.find((m) => m.id === id))
    .filter(Boolean) as Member[];

  const label = department?.name ?? "Unassigned";

  return (
    <div>
      <div
        ref={setNodeRef}
        onClick={onSelect}
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
          isOver && "ring-2 ring-primary ring-offset-1 bg-primary/5"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); onToggle?.(); }} className="p-0.5">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {department ? (
          <span className="flex-1 truncate font-medium">{label}</span>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">{label}</span>
        )}

        <span className="text-xs text-muted-foreground">{memberObjects.length}</span>

        {canManage && department && onCreateSub && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateSub(); }}
            className="p-0.5 text-muted-foreground hover:text-foreground"
            title="Create sub-department"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isExpanded && children}
    </div>
  );
}

// Create department inline form
function CreateDepartmentForm({
  companyId,
  parentId,
  onClose,
}: {
  companyId: string;
  parentId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("name", name.trim());
    if (parentId) formData.set("parentId", parentId);

    const result = await createDepartment(formData);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setName("");
      onClose();
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Department name"
        className="h-8 text-sm"
        autoFocus
        disabled={isLoading}
      />
      <Button type="submit" size="sm" disabled={isLoading || !name.trim()}>
        {isLoading ? "..." : "Add"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}

export function DepartmentManager({
  companyId,
  departments,
  membersByDept,
  unassignedUserIds,
  allMembers,
  canManage,
}: Props) {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(
    new Set(departments.map((d) => d.id))
  );
  const [activeDragUserId, setActiveDragUserId] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const toggleExpand = (deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragUserId(event.active.data.current?.userId ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragUserId(null);

    const { over, active } = event;
    if (!over || !canManage) return;

    const userId = active.data.current?.userId;
    const targetDeptId = over.data.current?.departmentId;

    if (!userId || !targetDeptId) return;

    // Check if already in this department
    const deptMembers = membersByDept[targetDeptId] ?? [];
    if (deptMembers.includes(userId)) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.set("departmentId", targetDeptId);
    formData.set("userId", userId);

    await addDepartmentMember(formData);
    setIsProcessing(false);
    router.refresh();
  };

  const handleRemoveMember = async (deptId: string, userId: string) => {
    // Find the department_membership ID
    // We need to call a server action that finds and removes it
    setIsProcessing(true);

    const admin = await fetch(`/api/departments/remove-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId: deptId, userId }),
    });

    setIsProcessing(false);
    router.refresh();
  };

  // Build tree
  const rootDepts = departments.filter((d) => !d.parent_id);
  const childrenOf = (parentId: string) =>
    departments.filter((d) => d.parent_id === parentId);

  const selectedMembers = selectedDeptId
    ? (membersByDept[selectedDeptId] ?? [])
    : unassignedUserIds;

  const selectedMemberObjects = selectedMembers
    .map((id) => allMembers.find((m) => m.id === id))
    .filter(Boolean) as Member[];

  const selectedDept = departments.find((d) => d.id === selectedDeptId);

  const renderDeptTree = (dept: Department, depth: number): React.ReactNode => {
    const children = childrenOf(dept.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedDepts.has(dept.id);

    return (
      <DepartmentDropZone
        key={dept.id}
        department={dept}
        members={membersByDept[dept.id] ?? []}
        allMembers={allMembers}
        isSelected={selectedDeptId === dept.id}
        onSelect={() => setSelectedDeptId(dept.id)}
        onRemoveMember={() => {}}
        onCreateSub={() => setCreatingParentId(dept.id)}
        canManage={canManage}
        isExpanded={isExpanded}
        onToggle={() => toggleExpand(dept.id)}
        hasChildren={hasChildren}
        depth={depth}
      >
        {creatingParentId === dept.id && (
          <CreateDepartmentForm
            companyId={companyId}
            parentId={dept.id}
            onClose={() => setCreatingParentId(undefined)}
          />
        )}
        {hasChildren &&
          children.map((child) => renderDeptTree(child, depth + 1))}
      </DepartmentDropZone>
    );
  };

  const draggedMember = activeDragUserId
    ? allMembers.find((m) => m.id === activeDragUserId)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Departments
          </CardTitle>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreatingParentId(null)}
            >
              <Plus className="mr-1 h-4 w-4" />
              New Department
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left panel: Department tree */}
            <div className="space-y-1 rounded-lg border p-2">
              {creatingParentId === null && (
                <CreateDepartmentForm
                  companyId={companyId}
                  parentId={null}
                  onClose={() => setCreatingParentId(undefined)}
                />
              )}

              {rootDepts.map((dept) => renderDeptTree(dept, 0))}

              {departments.length === 0 && creatingParentId === undefined && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No departments yet
                </p>
              )}

              <div className="mt-2 border-t pt-2">
                <DepartmentDropZone
                  department={null}
                  members={unassignedUserIds}
                  allMembers={allMembers}
                  isSelected={selectedDeptId === null}
                  onSelect={() => setSelectedDeptId(null)}
                  onRemoveMember={() => {}}
                  canManage={false}
                  depth={0}
                />
              </div>
            </div>

            {/* Right panel: Members of selected department */}
            <div className="rounded-lg border p-3">
              <h3 className="mb-3 text-sm font-medium">
                {selectedDept?.name ?? "Unassigned"}{" "}
                <span className="text-muted-foreground">
                  ({selectedMemberObjects.length})
                </span>
              </h3>

              {selectedMemberObjects.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {selectedDeptId
                    ? "No members. Drag users here to assign."
                    : "All users are assigned to departments."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedMemberObjects.map((member) => (
                    <div key={member.id} className="flex items-center gap-1">
                      <DraggableUser member={member} canDrag={canManage} />
                      {canManage && selectedDeptId && (
                        <button
                          onClick={() => handleRemoveMember(selectedDeptId, member.id)}
                          disabled={isProcessing}
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                          title="Remove from department"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DragOverlay>
            {draggedMember && (
              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm shadow-lg">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <span>{draggedMember.fullName || draggedMember.email || "Unnamed"}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}

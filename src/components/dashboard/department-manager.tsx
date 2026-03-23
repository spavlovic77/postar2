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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import {
  ChevronRight, ChevronDown, Plus, X, FolderPlus,
  GripVertical, Users, MoreHorizontal, Pencil, Trash2, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addDepartmentMember, createDepartment, renameDepartment, deleteDepartment } from "@/lib/actions";
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

function DraggableUser({ member, canDrag }: { member: Member; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `user-${member.id}`,
    data: { userId: member.id, memberName: member.fullName || member.email },
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

function DroppableDeptItem({
  dept,
  depth,
  isSelected,
  isExpanded,
  hasChildren,
  memberCount,
  isRenaming,
  canManage,
  onSelect,
  onToggle,
  onCreateSub,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: {
  dept: Department;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  memberCount: number;
  isRenaming: boolean;
  canManage: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onCreateSub: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `dept-${dept.id}`,
    data: { departmentId: dept.id },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer relative",
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
        isOver && "ring-2 ring-primary ring-offset-1 bg-primary/5"
      )}
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
      {depth > 0 && (
        <div
          className="absolute border-l border-b border-muted-foreground/20 rounded-bl-sm"
          style={{ left: `${(depth - 1) * 20 + 18}px`, top: 0, width: "12px", height: "50%" }}
        />
      )}

      {hasChildren ? (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5 z-10">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-5" />
      )}

      {isRenaming ? (
        <form
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); onRename(fd.get("name") as string); }}
          className="flex items-center gap-1 flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Input name="name" defaultValue={dept.name} className="h-7 text-sm" autoFocus onKeyDown={(e) => { if (e.key === "Escape") onCancelRename(); }} />
          <Button type="submit" size="sm" className="h-7 px-2 text-xs">Save</Button>
        </form>
      ) : (
        <>
          <span className="flex-1 truncate font-medium">{dept.name}</span>
          <span className="text-xs text-muted-foreground">{memberCount}</span>
          {canManage && (
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); onCreateSub(); }} className="p-0.5 text-muted-foreground hover:text-foreground" title="Create sub-department">
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-3.5 w-3.5" /></button>} />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onStartRename}><Pencil className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DroppableUnassigned({ isSelected, count, onSelect }: { isSelected: boolean; count: number; onSelect: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: "unassigned", data: { departmentId: null } });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
        isOver && "ring-2 ring-primary ring-offset-1 bg-primary/5"
      )}
    >
      <span className="w-5" />
      <span className="flex-1 truncate text-muted-foreground">Unassigned</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

function CreateDepartmentForm({ companyId, parentId, onClose, onSuccess }: {
  companyId: string; parentId: string | null; onClose: () => void; onSuccess: (name: string) => void;
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
    if (result.error) { setError(result.error); } else { onSuccess(name.trim()); setName(""); onClose(); router.refresh(); }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Department name" className="h-8 text-sm" autoFocus disabled={isLoading} />
      <Button type="submit" size="sm" disabled={isLoading || !name.trim()}>{isLoading ? "..." : "Add"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}

export function DepartmentManager({ companyId, departments, membersByDept, unassignedUserIds, allMembers, canManage }: Props) {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(departments.map((d) => d.id)));
  const [activeDragUserId, setActiveDragUserId] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null | undefined>(undefined);
  const [renamingDeptId, setRenamingDeptId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const toggleExpand = (id: string) => setExpandedDepts((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const handleDragStart = (e: DragStartEvent) => setActiveDragUserId(e.active.data.current?.userId ?? null);

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDragUserId(null);
    const { over, active } = e;
    if (!over || !canManage) return;
    const userId = active.data.current?.userId;
    const memberName = active.data.current?.memberName;
    const targetDeptId = over.data.current?.departmentId;
    if (!userId || !targetDeptId) return;
    if ((membersByDept[targetDeptId] ?? []).includes(userId)) { toast("Already in this department", "error"); return; }
    setIsProcessing(true);
    const fd = new FormData();
    fd.set("departmentId", targetDeptId);
    fd.set("userId", userId);
    const result = await addDepartmentMember(fd);
    setIsProcessing(false);
    if (result.error) { toast(result.error, "error"); } else {
      toast(`${memberName ?? "User"} added to ${departments.find((d) => d.id === targetDeptId)?.name ?? "department"}`);
      router.refresh();
    }
  };

  const handleRemoveMember = async (deptId: string, userId: string) => {
    setIsProcessing(true);
    await fetch("/api/departments/remove-member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ departmentId: deptId, userId }) });
    setIsProcessing(false);
    const m = allMembers.find((m) => m.id === userId);
    toast(`${m?.fullName || m?.email || "User"} removed from ${departments.find((d) => d.id === deptId)?.name ?? "department"}`);
    router.refresh();
  };

  const handleRename = async (deptId: string, name: string) => {
    setRenamingDeptId(null);
    const r = await renameDepartment(deptId, name);
    if (r.error) toast(r.error, "error"); else { toast(`Renamed to "${name}"`); router.refresh(); }
  };

  const handleDelete = async (deptId: string) => {
    const r = await deleteDepartment(deptId);
    if (r.error) toast(r.error, "error"); else { toast("Department deleted"); if (selectedDeptId === deptId) setSelectedDeptId(null); router.refresh(); }
  };

  const rootDepts = departments.filter((d) => !d.parent_id);
  const childrenOf = (pid: string) => departments.filter((d) => d.parent_id === pid);
  const selectedMembers = selectedDeptId ? (membersByDept[selectedDeptId] ?? []) : unassignedUserIds;
  const selectedMemberObjects = selectedMembers.map((id) => allMembers.find((m) => m.id === id)).filter(Boolean) as Member[];
  const selectedDept = departments.find((d) => d.id === selectedDeptId);
  const draggedMember = activeDragUserId ? allMembers.find((m) => m.id === activeDragUserId) : null;

  const renderTree = (dept: Department, depth: number): React.ReactNode => {
    const children = childrenOf(dept.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedDepts.has(dept.id);

    return (
      <div key={dept.id}>
        <DroppableDeptItem
          dept={dept}
          depth={depth}
          isSelected={selectedDeptId === dept.id}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          memberCount={(membersByDept[dept.id] ?? []).length}
          isRenaming={renamingDeptId === dept.id}
          canManage={canManage}
          onSelect={() => setSelectedDeptId(dept.id)}
          onToggle={() => toggleExpand(dept.id)}
          onCreateSub={() => setCreatingParentId(dept.id)}
          onStartRename={() => setRenamingDeptId(dept.id)}
          onRename={(name) => handleRename(dept.id, name)}
          onCancelRename={() => setRenamingDeptId(null)}
          onDelete={() => handleDelete(dept.id)}
        />
        {creatingParentId === dept.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}>
            <CreateDepartmentForm companyId={companyId} parentId={dept.id} onClose={() => setCreatingParentId(undefined)} onSuccess={(n) => toast(`Created "${n}"`)} />
          </div>
        )}
        {isExpanded && hasChildren && (
          <div className="relative">
            <div className="absolute border-l border-muted-foreground/20" style={{ left: `${depth * 20 + 18}px`, top: 0, bottom: "12px" }} />
            {children.map((c) => renderTree(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Departments</CardTitle>
          {canManage && <Button size="sm" variant="outline" onClick={() => setCreatingParentId(null)}><Plus className="mr-1 h-4 w-4" />New Department</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 rounded-lg border p-2">
              {creatingParentId === null && <CreateDepartmentForm companyId={companyId} parentId={null} onClose={() => setCreatingParentId(undefined)} onSuccess={(n) => toast(`Created "${n}"`)} />}
              {rootDepts.map((d) => renderTree(d, 0))}
              {departments.length === 0 && creatingParentId === undefined && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="rounded-full bg-muted p-3"><Users className="h-6 w-6 text-muted-foreground" /></div>
                  <div><p className="text-sm font-medium">No departments yet</p><p className="mt-1 text-xs text-muted-foreground">Create your first department, then drag<br />team members from the right panel into it.</p></div>
                  {canManage && <Button size="sm" variant="outline" onClick={() => setCreatingParentId(null)}><Plus className="mr-1 h-4 w-4" />Create First Department</Button>}
                </div>
              )}
              <div className="mt-2 border-t pt-2">
                <DroppableUnassigned isSelected={selectedDeptId === null} count={unassignedUserIds.length} onSelect={() => setSelectedDeptId(null)} />
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <h3 className="mb-3 text-sm font-medium">{selectedDept?.name ?? "Unassigned"} <span className="text-muted-foreground">({selectedMemberObjects.length})</span></h3>
              {selectedMemberObjects.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  {selectedDeptId ? (
                    <><ArrowRight className="h-6 w-6 text-muted-foreground rotate-180 md:rotate-0" /><p className="text-sm text-muted-foreground">Drag users from <strong>Unassigned</strong> or other departments here</p></>
                  ) : (
                    <p className="text-sm text-muted-foreground">All users are assigned to departments</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedMemberObjects.map((m) => (
                    <div key={m.id} className="flex items-center gap-1">
                      <DraggableUser member={m} canDrag={canManage} />
                      {canManage && selectedDeptId && (
                        <button onClick={() => handleRemoveMember(selectedDeptId, m.id)} disabled={isProcessing} className="rounded p-0.5 text-muted-foreground hover:text-destructive" title="Remove"><X className="h-3 w-3" /></button>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './apiClient';
import {
  NO_SHOPPING_DEPARTMENTS,
  normalizeProductName,
  withShoppingAssignment,
  withoutShoppingDepartment,
  type ShoppingDepartments,
} from './shoppingCategories';

export const DEPARTMENT_DELETE_DELAY_MS = 6000;

export type DepartmentMove = { department: string } | { new_department_name: string };

interface DepartmentEvents {
  onMoved: (label: string) => void;
  onMoveFailed: () => void;
  onDeleted: (undo: () => void) => void;
  onDeleteFailed: () => void;
}

type PendingMoves = Record<string, { id: number; department?: string }>;

export function applyPendingDepartments(
  saved: ShoppingDepartments,
  moves: PendingMoves,
  deletes: string[],
): ShoppingDepartments {
  const moved = Object.entries(moves).reduce(
    (current, [productName, move]) => (move.department ? withShoppingAssignment(current, productName, move.department) : current),
    saved,
  );
  return deletes.reduce(withoutShoppingDepartment, moved);
}

export function useShoppingDepartments(events: DepartmentEvents) {
  const [saved, setSaved] = useState<ShoppingDepartments>(NO_SHOPPING_DEPARTMENTS);
  const [moves, setMoves] = useState<PendingMoves>({});
  const [deletes, setDeletes] = useState<string[]>([]);
  const lastRequest = useRef(0);
  const lastApplied = useRef(0);
  const deleteTimers = useRef(new Map<string, number>());
  const latestEvents = useRef(events);

  useEffect(() => {
    latestEvents.current = events;
  });

  const apply = useCallback((response: ShoppingDepartments, requestId: number) => {
    if (requestId <= lastApplied.current) return false;
    lastApplied.current = requestId;
    setSaved(response);
    return true;
  }, []);

  const reload = useCallback(() => {
    const requestId = ++lastRequest.current;
    return api.shoppingList.getDepartments()
      .then(response => {
        apply(response, requestId);
      })
      .catch(err => console.error('Error loading shopping departments:', err));
  }, [apply]);

  useEffect(() => {
    reload();
  }, [reload]);

  const finish = useCallback((response: ShoppingDepartments, requestId: number) => {
    if (!apply(response, requestId)) reload();
  }, [apply, reload]);

  const move = async (productName: string, request: DepartmentMove, label: string) => {
    const requestId = ++lastRequest.current;
    const key = normalizeProductName(productName);
    const department = 'department' in request ? request.department : undefined;
    setMoves(current => ({ ...current, [key]: { id: requestId, department } }));
    try {
      finish(await api.shoppingList.assignDepartment({ product_name: productName, ...request }), requestId);
      latestEvents.current.onMoved(label);
    } catch (err) {
      console.error('Error moving item:', err);
      latestEvents.current.onMoveFailed();
    } finally {
      setMoves(current => {
        if (current[key]?.id !== requestId) return current;
        const rest = { ...current };
        delete rest[key];
        return rest;
      });
    }
  };

  const commitDelete = useCallback(async (departmentId: string) => {
    deleteTimers.current.delete(departmentId);
    const requestId = ++lastRequest.current;
    try {
      finish(await api.shoppingList.deleteDepartment(departmentId), requestId);
    } catch (err) {
      console.error('Error deleting department:', err);
      latestEvents.current.onDeleteFailed();
    } finally {
      setDeletes(current => current.filter(id => id !== departmentId));
    }
  }, [finish]);

  const remove = (departmentId: string) => {
    setDeletes(current => (current.includes(departmentId) ? current : [...current, departmentId]));
    deleteTimers.current.set(departmentId, window.setTimeout(() => commitDelete(departmentId), DEPARTMENT_DELETE_DELAY_MS));
    latestEvents.current.onDeleted(() => {
      window.clearTimeout(deleteTimers.current.get(departmentId));
      deleteTimers.current.delete(departmentId);
      setDeletes(current => current.filter(id => id !== departmentId));
    });
  };

  useEffect(() => {
    const timers = deleteTimers.current;
    return () => {
      timers.forEach((timer, departmentId) => {
        window.clearTimeout(timer);
        api.shoppingList.deleteDepartment(departmentId).catch(err => console.error('Error deleting department:', err));
      });
      timers.clear();
    };
  }, []);

  const departments = useMemo(() => applyPendingDepartments(saved, moves, deletes), [saved, moves, deletes]);

  return { departments, move, remove };
}

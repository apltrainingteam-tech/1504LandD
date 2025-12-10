import React, { useState, useEffect, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
    auth, loginWithGoogle, logout, loadUserData, saveUserData 
} from './services/firebase';
import { 
    Workspace, FilterState, ViewMode, DraggedTaskInfo, Task, Recurrence, List, RosterData 
} from './types';
import Board from './components/Board';
import CalendarView from './components/CalendarView';
import RosterView from './components/RosterView';
import RecurrencePopup from './components/RecurrencePopup';
import TaskPopup from './components/TaskPopup';
import { Layout, LogOut, Loader2, Calendar as CalIcon, AlertTriangle, X, Copy, ExternalLink, ShieldAlert, RefreshCw, Save, Upload, Download, Trash2, Plus, GripVertical, User, FileSpreadsheet } from 'lucide-react';

const App = () => {
    // Auth State
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);

    // App Data State
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [savedWorkspaces, setSavedWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    // Default assignees updated to user request
    const [assignees, setAssignees] = useState<string[]>(['Pramod', 'Kaushik', 'Prayas', 'Sreenath', 'Sunil', 'Rutuja', 'Vivek', 'Romy', 'Meiraj']);
    const [rosterData, setRosterData] = useState<RosterData>({});
    
    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('tasks');
    const [filters, setFilters] = useState<FilterState>({ status: 'all', dueDate: '', assignee: 'all' });
    const [sortOption, setSortOption] = useState('custom');
    const [draggedTaskInfo, setDraggedTaskInfo] = useState<DraggedTaskInfo | null>(null);
    const [recurrencePopup, setRecurrencePopup] = useState<{task: Task, listId: string} | null>(null);
    const [popupTask, setPopupTask] = useState<{task: Task, listId: string} | null>(null);
    const [previewImage, setPreviewImage] = useState<any>(null);

    // Modals
    const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'blank' | 'load' | 'import'>('blank');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
    const [newAssigneeName, setNewAssigneeName] = useState('');

    // --- Authentication & Data Loading ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const data = await loadUserData(currentUser.uid);
                    if (data) {
                        setWorkspaces(data.workspaces || []);
                        setSavedWorkspaces(data.savedWorkspaces || []);
                        // Use loaded assignees or fallback to the new default list
                        setAssignees(data.assignees || ['Pramod', 'Kaushik', 'Prayas', 'Sreenath', 'Sunil', 'Rutuja', 'Vivek', 'Romy', 'Meiraj']);
                        setRosterData(data.rosterData || {});
                        setActiveWorkspaceId(data.activeWorkspaceId || (data.workspaces?.[0]?.id || null));
                    } else {
                        // Initialize default data for new user
                        const defaultWorkspace: Workspace = {
                            id: Date.now().toString(),
                            name: 'My First Project',
                            lists: [
                                { id: '1', name: 'To Do', tasks: [] },
                                { id: '2', name: 'In Progress', tasks: [] },
                                { id: '3', name: 'Done', tasks: [] }
                            ]
                        };
                        setWorkspaces([defaultWorkspace]);
                        setActiveWorkspaceId(defaultWorkspace.id);
                    }
                } catch (err: any) {
                    console.error("Failed to load data", err);
                    if (err.code === 'permission-denied' || err.message?.includes('permission-denied')) {
                        setConfigError("PERMISSION_DENIED");
                    }
                }
            } else {
                setWorkspaces([]);
                setActiveWorkspaceId(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Persistence ---
    const saveData = async () => {
        if (!user) return;
        try {
            await saveUserData(user.uid, {
                workspaces,
                savedWorkspaces,
                assignees,
                rosterData,
                activeWorkspaceId
            });
        } catch (err: any) {
            console.error("Save failed", err);
            // Check specifically for permission errors
            if (err.code === 'permission-denied' || err.message?.includes('permission-denied') || err.message?.includes('Missing or insufficient permissions')) {
                setConfigError("PERMISSION_DENIED");
            }
        }
    };

    useEffect(() => {
        if (!user || workspaces.length === 0) return;
        const timer = setTimeout(() => {
            saveData();
        }, 2000); 
        return () => clearTimeout(timer);
    }, [workspaces, savedWorkspaces, assignees, rosterData, activeWorkspaceId, user]);

    // --- Auth Handler ---
    const handleLogin = async () => {
        setConfigError(null);
        try {
            await loginWithGoogle();
        } catch (error: any) {
            const errCode = error.code || '';
            const errMsg = error.message || '';
            if (errCode === 'auth/api-key-not-valid' || errMsg.includes('api-key-not-valid')) setConfigError("MISSING_API_KEY");
            else if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain')) setConfigError("UNAUTHORIZED_DOMAIN");
            else if (errCode !== 'auth/popup-closed-by-user') alert(`Login failed: ${errMsg}`);
        }
    };

    // --- Helpers ---
    const findTask = (data: Workspace[], id: string): Task | null => {
        for(const w of data) {
            for(const l of w.lists) {
                const search = (tasks: Task[]): Task | null => {
                    for(const t of tasks) {
                        if(t.id === id) return t;
                        const res = search(t.subtasks);
                        if(res) return res;
                    }
                    return null;
                }
                const found = search(l.tasks);
                if(found) return found;
            }
        }
        return null;
    };

    const findTaskAndModify = (tasks: Task[], taskId: string, modifyCallback: (t: Task) => Task): Task[] => {
        return tasks.map(task => {
            if (task.id === taskId) return modifyCallback(task);
            if (task.subtasks?.length > 0) return { ...task, subtasks: findTaskAndModify(task.subtasks, taskId, modifyCallback) };
            return task;
        });
    };

    // --- Handlers (CRUD) ---
    const handlers = {
        onUpdateWorkspace: (id: string, patch: Partial<Workspace>) => setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w)),
        onAddList: (workspaceId: string) => {
            const name = prompt("List Name:");
            if (!name) return;
            setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, lists: [...w.lists, { id: Date.now().toString(), name, tasks: [] }] } : w));
        },
        onUpdateList: (listId: string, patch: Partial<List>) => setWorkspaces(prev => prev.map(w => ({ ...w, lists: w.lists.map(l => l.id === listId ? { ...l, ...patch } : l) }))),
        onDeleteList: (listId: string) => { if (confirm("Delete list?")) setWorkspaces(prev => prev.map(w => ({ ...w, lists: w.lists.filter(l => l.id !== listId) }))); },
        onAddTask: (listId: string) => {
            const newTask: Task = { id: Date.now().toString(), text: 'New Task', completed: false, subtasks: [], checklist: [] };
            setWorkspaces(prev => prev.map(w => ({ ...w, lists: w.lists.map(l => l.id === listId ? { ...l, tasks: [...l.tasks, newTask] } : l) })));
        },
        onUpdateTask: (listId: string, taskId: string, patch: Partial<Task>) => {
            setWorkspaces(prev => prev.map(w => ({ ...w, lists: w.lists.map(l => l.id !== listId ? l : { ...l, tasks: findTaskAndModify(l.tasks, taskId, t => ({ ...t, ...patch })) }) })));
        },
        onDeleteTask: (listId: string, taskId: string) => {
            const deleteRecursive = (tasks: Task[]): Task[] => tasks.filter(t => t.id !== taskId).map(t => ({ ...t, subtasks: deleteRecursive(t.subtasks) }));
            setWorkspaces(prev => prev.map(w => ({ ...w, lists: w.lists.map(l => l.id !== listId ? l : { ...l, tasks: deleteRecursive(l.tasks) }) })));
        },
        onAddSubtask: (listId: string, parentId: string) => {
             const newSub: Task = { id: Date.now().toString(), text: 'Subtask', completed: false, subtasks: [], checklist: [] };
             handlers.onUpdateTask(listId, parentId, { subtasks: [...(findTask(workspaces, parentId)?.subtasks || []), newSub] });
        },
        onAddChecklistItem: (listId: string, taskId: string) => {
            const newItem = { id: Date.now().toString(), text: 'New Item', completed: false };
            const t = findTask(workspaces, taskId);
            if(t) handlers.onUpdateTask(listId, taskId, { checklist: [...t.checklist, newItem] });
        },
        onUpdateChecklistItem: (listId: string, taskId: string, itemId: string, patch: any) => {
            const t = findTask(workspaces, taskId);
            if(t) handlers.onUpdateTask(listId, taskId, { checklist: t.checklist.map(i => i.id === itemId ? { ...i, ...patch } : i) });
        },
        onToggleChecklistItem: (listId: string, taskId: string, itemId: string) => {
             const t = findTask(workspaces, taskId);
             if(t) {
                 const item = t.checklist.find(i => i.id === itemId);
                 if(item) handlers.onUpdateTask(listId, taskId, { checklist: t.checklist.map(i => i.id === itemId ? { ...i, completed: !item.completed } : i) });
             }
        },
        onDeleteChecklistItem: (listId: string, taskId: string, itemId: string) => {
            const t = findTask(workspaces, taskId);
            if(t) handlers.onUpdateTask(listId, taskId, { checklist: t.checklist.filter(i => i.id !== itemId) });
        },
        onAttachFile: async (listId: string, taskId: string, file: File) => {
             if (file.size > 5 * 1024 * 1024) { alert('File is too large. Max 5MB.'); return; }
             const reader = new FileReader();
             reader.onload = () => {
                 const newAttachment = { id: Date.now().toString(), name: file.name, type: file.type, data: reader.result as string };
                 const t = findTask(workspaces, taskId);
                 if(t) handlers.onUpdateTask(listId, taskId, { attachments: [...(t.attachments || []), newAttachment] });
             };
             reader.readAsDataURL(file);
        },
        onPasteAttachment: async (listId: string, taskId: string) => {
            try {
                const items = await navigator.clipboard.read();
                const imageItem = items.find(item => item.types.some(type => type.startsWith('image/')));
                if (!imageItem) { alert('No image on clipboard'); return; }
                const blob = await imageItem.getType(imageItem.types.find(t => t.startsWith('image/'))!);
                const reader = new FileReader();
                reader.onload = () => {
                    const newAttachment = { id: Date.now().toString(), name: `Pasted Image ${Date.now()}`, type: blob.type, data: reader.result as string };
                    const t = findTask(workspaces, taskId);
                    if(t) handlers.onUpdateTask(listId, taskId, { attachments: [...(t.attachments || []), newAttachment] });
                };
                reader.readAsDataURL(blob);
            } catch (e) { alert("Clipboard access failed or not supported."); }
        },
        onDeleteAttachment: (listId: string, taskId: string, attachmentId: string) => {
            const t = findTask(workspaces, taskId);
            if(t) handlers.onUpdateTask(listId, taskId, { attachments: t.attachments?.filter(a => a.id !== attachmentId) });
        },
        onPreviewAttachment: (att: any) => {
             if(att.type.startsWith('image/')) setPreviewImage(att);
             else window.open(att.data, '_blank');
        },
        onShowRecurrencePopup: (task: Task, listId: string) => setRecurrencePopup({ task, listId }),
        onSaveAsTemplate: (workspaceId: string) => {
            const ws = workspaces.find(w => w.id === workspaceId);
            if (ws) {
                const name = prompt('Template Name:', `${ws.name} Template`);
                if (name) {
                    const template = { ...JSON.parse(JSON.stringify(ws)), id: Date.now().toString(), name };
                    setSavedWorkspaces(prev => [...prev, template]);
                    alert('Template saved!');
                }
            }
        },
        onOpenTaskPopup: (task: Task, listId: string) => setPopupTask({ task, listId }),
        // Drag Logic
        onTaskDragStart: (e: React.DragEvent, info: DraggedTaskInfo) => { e.stopPropagation(); setDraggedTaskInfo(info); },
        onTaskDrop: (e: React.DragEvent, target: DraggedTaskInfo) => {
            e.preventDefault(); e.stopPropagation();
            if (!draggedTaskInfo) return;
            const { listId: srcList, taskId: srcTask } = draggedTaskInfo;
            const { listId: tgtList, taskId: tgtTask } = target;
            
            // Simplified: Prevent dragging into self or cross-workspace (implicitly handled by list lookup)
            if (srcTask === tgtTask) { setDraggedTaskInfo(null); return; }

            setWorkspaces(prev => {
                const newState = JSON.parse(JSON.stringify(prev));
                const ws = newState.find((w: Workspace) => w.id === activeWorkspaceId);
                const sList = ws.lists.find((l: List) => l.id === srcList);
                const tList = ws.lists.find((l: List) => l.id === tgtList);

                // Find and remove source task
                let taskObj: Task | null = null;
                const removeRecursively = (tasks: Task[]): Task[] => {
                    const result = [];
                    for(const t of tasks) {
                        if(t.id === srcTask) { taskObj = t; } 
                        else {
                            if(t.subtasks) t.subtasks = removeRecursively(t.subtasks);
                            result.push(t);
                        }
                    }
                    return result;
                }
                sList.tasks = removeRecursively(sList.tasks);
                if (!taskObj) return prev; // Failed to find task

                // Insert target task
                // Check if dropping on a task to make it a child or sibling
                // Simplified: Insert After for now, unless specific logic added
                let inserted = false;
                const insertRecursively = (tasks: Task[]): Task[] => {
                    if (inserted) return tasks;
                    const idx = tasks.findIndex(t => t.id === tgtTask);
                    if (idx !== -1) {
                         // Decide placement based on drop position logic passed from component? 
                         // For simplicity, insert after
                         const newArr = [...tasks];
                         newArr.splice(idx + 1, 0, taskObj!);
                         inserted = true;
                         return newArr;
                    }
                    return tasks.map(t => ({...t, subtasks: insertRecursively(t.subtasks)}));
                }

                // Special case: Dropping into empty list
                if (tList.tasks.length === 0 && !tgtTask) {
                    tList.tasks.push(taskObj);
                } else {
                    tList.tasks = insertRecursively(tList.tasks);
                }

                return newState;
            });
            setDraggedTaskInfo(null);
        },
        draggedTaskInfo
    };

    const onUpdateRoster = (key: string, data: any[][]) => {
        setRosterData(prev => ({
            ...prev,
            [key]: data
        }));
    };

    // --- Modal Logic ---
    const handleCreateWorkspace = () => {
        if (modalMode === 'blank' && newWorkspaceName) {
            const newWs: Workspace = {
                id: Date.now().toString(),
                name: newWorkspaceName,
                lists: [{ id: Date.now().toString() + '1', name: 'To Do', tasks: [] }]
            };
            setWorkspaces([...workspaces, newWs]);
            setActiveWorkspaceId(newWs.id);
        } else if (modalMode === 'load' && selectedTemplateId) {
             const tpl = savedWorkspaces.find(w => w.id === selectedTemplateId);
             if(tpl) {
                 const newWs = { ...JSON.parse(JSON.stringify(tpl)), id: Date.now().toString(), name: `${tpl.name} (Copy)` };
                 setWorkspaces([...workspaces, newWs]);
                 setActiveWorkspaceId(newWs.id);
             }
        }
        setIsWorkspaceModalOpen(false);
        setNewWorkspaceName('');
    };

    const handleManualBackup = () => {
        const data = { workspaces, savedWorkspaces, assignees, rosterData, version: '1.1', date: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orbit-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleManualImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const json = JSON.parse(text);
                if (json.workspaces) setWorkspaces(json.workspaces);
                if (json.savedWorkspaces) setSavedWorkspaces(json.savedWorkspaces);
                if (json.assignees) setAssignees(json.assignees);
                if (json.rosterData) setRosterData(json.rosterData);
                alert("Import successful!");
            } catch (err) { alert("Invalid backup file."); }
        };
        input.click();
    };

    // --- Render ---

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-indigo-600 w-10 h-10"/></div>;

    if (!user) {
        // ... (Login Screen)
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-4">
                 <div className="bg-white text-slate-900 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative">
                    <h1 className="text-4xl font-bold font-heading mb-4 text-indigo-700">Orbit</h1>
                    <p className="text-slate-600 mb-8">Organize your life with powerful task management.</p>
                    <button onClick={handleLogin} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2">Sign in with Google</button>
                 </div>
                 {configError && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"><div className="bg-white p-6 rounded text-black"><p>Configuration Error: {configError}</p><button onClick={()=>setConfigError(null)}>Close</button></div></div>}
            </div>
        );
    }

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

    return (
        <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold font-heading text-lg">O</div>
                    <h1 className="text-xl font-bold font-heading hidden md:block">Orbit</h1>
                    <div className="h-6 w-px bg-slate-300 mx-2"></div>
                    <select 
                        value={activeWorkspaceId || ''} 
                        onChange={(e) => setActiveWorkspaceId(e.target.value)}
                        className="bg-slate-100 border-none rounded-md px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                        {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* View Switcher */}
                    <div className="flex bg-slate-100 rounded-lg p-1 mr-4">
                        <button onClick={() => setViewMode('tasks')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'tasks' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Tasks</button>
                        <button onClick={() => setViewMode('calendar')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Month</button>
                        <button onClick={() => setViewMode('week')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Week</button>
                        <button onClick={() => setViewMode('today')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'today' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Today</button>
                        <button onClick={() => setViewMode('roster')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${viewMode === 'roster' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>
                            Roster
                        </button>
                    </div>

                    <div className="flex gap-1">
                        <button onClick={() => { setModalMode('blank'); setIsWorkspaceModalOpen(true); }} className="p-2 hover:bg-slate-100 rounded-full" title="New Workspace"><Plus size={20}/></button>
                        <button onClick={handleManualBackup} className="p-2 hover:bg-slate-100 rounded-full" title="Backup to File"><Download size={20}/></button>
                        <button onClick={handleManualImport} className="p-2 hover:bg-slate-100 rounded-full" title="Restore from File"><Upload size={20}/></button>
                        <button onClick={() => setIsAssigneeModalOpen(true)} className="p-2 hover:bg-slate-100 rounded-full" title="Manage Assignees"><User size={20}/></button>
                        <button onClick={logout} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full" title="Sign Out"><LogOut size={20}/></button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow overflow-hidden p-4 relative">
                {!activeWorkspace ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                        <p>No workspace selected</p>
                        <button onClick={() => { setModalMode('blank'); setIsWorkspaceModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded">Create Workspace</button>
                    </div>
                ) : (
                    <>
                        {viewMode === 'tasks' && (
                            <Board 
                                workspace={activeWorkspace}
                                assignees={assignees}
                                filters={filters}
                                sortOption={sortOption}
                                handlers={handlers}
                            />
                        )}
                        {viewMode === 'calendar' && (
                            <CalendarView 
                                workspaces={workspaces}
                                activeWorkspaceId={activeWorkspaceId}
                                viewMode='calendar'
                                handlers={handlers}
                                filters={filters}
                                assignees={assignees}
                            />
                        )}
                         {viewMode === 'week' && (
                            <CalendarView 
                                workspaces={workspaces}
                                activeWorkspaceId={activeWorkspaceId}
                                viewMode='week'
                                handlers={handlers}
                                filters={filters}
                                assignees={assignees}
                            />
                        )}
                         {viewMode === 'today' && (
                            <CalendarView 
                                workspaces={workspaces}
                                activeWorkspaceId={activeWorkspaceId}
                                viewMode='today'
                                handlers={handlers}
                                filters={filters}
                                assignees={assignees}
                            />
                        )}
                        {viewMode === 'roster' && (
                            <RosterView 
                                rosterData={rosterData}
                                onUpdateRoster={onUpdateRoster}
                                assignees={assignees}
                            />
                        )}
                    </>
                )}
            </main>

            {/* Modals */}
            {isWorkspaceModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-[400px] shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Workspace Actions</h2>
                        <div className="flex gap-4 mb-4 border-b">
                            <button onClick={() => setModalMode('blank')} className={`pb-2 ${modalMode === 'blank' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500'}`}>New</button>
                            <button onClick={() => setModalMode('load')} className={`pb-2 ${modalMode === 'load' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500'}`}>Load Template</button>
                        </div>
                        
                        {modalMode === 'blank' ? (
                            <input value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} placeholder="Workspace Name" className="w-full border p-2 rounded mb-4"/>
                        ) : (
                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                {savedWorkspaces.length === 0 && <p className="text-sm text-slate-500">No templates saved.</p>}
                                {savedWorkspaces.map(w => (
                                    <div key={w.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded cursor-pointer" onClick={() => setSelectedTemplateId(w.id)}>
                                        <div className="flex items-center gap-2">
                                            <input type="radio" checked={selectedTemplateId === w.id} onChange={() => setSelectedTemplateId(w.id)} />
                                            <span>{w.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsWorkspaceModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                            <button onClick={handleCreateWorkspace} className="px-4 py-2 bg-indigo-600 text-white rounded">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {isAssigneeModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl p-6 w-[350px] shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Manage Assignees</h2>
                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                            {assignees.map(a => (
                                <div key={a} className="flex justify-between bg-slate-50 p-2 rounded">
                                    <span>{a}</span>
                                    <button onClick={() => setAssignees(assignees.filter(x => x !== a))} className="text-red-500"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={newAssigneeName} onChange={e => setNewAssigneeName(e.target.value)} placeholder="New Name" className="border p-2 rounded flex-grow"/>
                            <button onClick={() => { if(newAssigneeName) { setAssignees([...assignees, newAssigneeName]); setNewAssigneeName(''); }}} className="bg-indigo-600 text-white p-2 rounded"><Plus/></button>
                        </div>
                        <button onClick={() => setIsAssigneeModalOpen(false)} className="mt-4 w-full bg-slate-200 py-2 rounded">Close</button>
                     </div>
                </div>
            )}

            {recurrencePopup && (
                <RecurrencePopup 
                    task={recurrencePopup.task}
                    onClose={() => setRecurrencePopup(null)}
                    onSave={(rec) => {
                        handlers.onUpdateTask(recurrencePopup.listId, recurrencePopup.task.id, { recurrence: rec });
                    }}
                />
            )}
            
            {popupTask && (
                <TaskPopup
                    task={popupTask.task}
                    listId={popupTask.listId}
                    assignees={assignees}
                    onUpdate={handlers.onUpdateTask}
                    onClose={() => setPopupTask(null)}
                />
            )}
            
            {previewImage && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                    <img src={previewImage.data} alt="Preview" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                </div>
            )}
        </div>
    );
};

export default App;
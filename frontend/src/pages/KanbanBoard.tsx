import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  User, 
  ChevronRight, 
  ChevronLeft,
  Calendar,
  Layers,
  Link
} from 'lucide-react';

export default function KanbanBoard() {
  const { currentWorkspace } = useAppStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Fetch workspace details (tasks and members)
  const fetchWorkspaceData = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await api.get(`/workspaces/${currentWorkspace._id}`);
      if (res.success) {
        setTasks(res.data.tasks || []);
        setMembers(res.data.workspace.members || []);
      }
    } catch (e) {
      console.error('Failed to load Kanban tasks', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, [currentWorkspace]);

  // Handle task status update (movement)
  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
      
      const res = await api.put(`/workspaces/tasks/${taskId}`, { status: newStatus });
      if (!res.success) {
        // Rollback
        fetchWorkspaceData();
      }
    } catch (err) {
      console.error(err);
      fetchWorkspaceData();
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      handleUpdateStatus(taskId, status);
    }
  };

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentWorkspace) return;

    try {
      const res = await api.post(`/workspaces/${currentWorkspace._id}/tasks`, {
        title,
        description,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null
      });

      if (res.success) {
        setTasks(prev => [...prev, res.data]);
        setTitle('');
        setDescription('');
        setPriority('medium');
        setAssigneeId('');
        setDueDate('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this task?');
    if (!confirmDelete) return;

    try {
      const res = await api.delete(`/workspaces/tasks/${taskId}`);
      if (res.success) {
        setTasks(prev => prev.filter(t => t._id !== taskId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Status Columns definitions
  const columns = [
    { id: 'todo', name: 'To Do', color: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' },
    { id: 'in-progress', name: 'In Progress', color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
    { id: 'review', name: 'In Review', color: 'bg-pink-500/10 border-pink-500/20 text-pink-400' },
    { id: 'done', name: 'Done', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  ];

  if (!currentWorkspace) {
    return (
      <div className="text-center p-12 space-y-4">
        <AlertCircle className="h-10 w-10 text-slate-500 mx-auto" />
        <p className="text-slate-400 text-xs">Please select or create a Workspace from the sidebar to view the Kanban board.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400" />
            Project Board
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Organize, delegate, and track deliverables in real-time.
          </p>
        </div>
        
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/10 transition-all hover:translate-y-[-1px] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create Task
        </button>
      </div>

      {/* Task Creation Form Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel rounded-xl shadow-2xl overflow-hidden border-slate-800">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-400" />
                Create Project Task
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task description short title..."
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Elaborate details about requirements or files..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Assignee</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m: any) => (
                      <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                        {m.user?.name || 'Loading member...'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Due Date</label>
                <input 
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-300"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Create Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kanban Board Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
          <div className="spinner" />
          Loading workspace issues board...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {columns.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div 
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex flex-col min-h-[500px] border border-slate-800 rounded-2xl p-4 glass-panel shadow-sm"
              >
                {/* Column Title */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${col.color}`}>
                    {col.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 font-mono bg-slate-800/50 px-1.5 py-0.5 rounded">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex-1 space-y-3.5 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="h-32 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-[10px]">
                      Drag tasks here
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const assigneeInitials = task.assignee?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';
                      return (
                        <div 
                          key={task._id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task._id)}
                          className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all duration-300 cursor-grab active:cursor-grabbing relative group shadow-sm"
                        >
                          <div className="space-y-2.5">
                            {/* Card top */}
                            <div className="flex justify-between items-start gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {task.priority}
                              </span>
                              
                              <button 
                                onClick={() => handleDeleteTask(task._id)}
                                className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5"
                                title="Delete task"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Card Body */}
                            <div>
                              <h4 className="text-xs font-bold text-slate-200 line-clamp-2">{task.title}</h4>
                              {task.description && (
                                <p className="text-[10px] text-slate-500 mt-1 line-clamp-3 leading-relaxed font-normal">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            {/* Indicators */}
                            <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-[9px] text-slate-400 font-medium">
                              
                              {/* Meeting Link badge */}
                              {task.meetingId ? (
                                <span className="inline-flex items-center gap-0.5 text-indigo-400 font-semibold" title="Converted from AI action item">
                                  <Link className="h-3 w-3" />
                                  Meeting origin
                                </span>
                              ) : (
                                <span />
                              )}

                              <div className="flex items-center gap-3 shrink-0">
                                {task.dueDate && (
                                  <span className="flex items-center gap-0.5 text-slate-500" title="Due date">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                                
                                {/* Assignee Bubble */}
                                {task.assignee ? (
                                  task.assignee.avatar && (task.assignee.avatar.startsWith('http://') || task.assignee.avatar.startsWith('https://')) ? (
                                    <img
                                      src={task.assignee.avatar}
                                      alt={task.assignee.name}
                                      className="h-5.5 w-5.5 rounded-full object-cover border border-slate-300"
                                      title={`Assigned to ${task.assignee.name}`}
                                    />
                                  ) : (
                                    <div 
                                      style={{ backgroundColor: task.assignee.avatar || '#6366f1' }}
                                      className="h-5.5 w-5.5 rounded-full flex items-center justify-center font-bold text-[8px] text-white border border-slate-350"
                                      title={`Assigned to ${task.assignee.name}`}
                                    >
                                      {assigneeInitials}
                                    </div>
                                  )
                                ) : (
                                  <div 
                                    className="h-5.5 w-5.5 rounded-full bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-500"
                                    title="Unassigned"
                                  >
                                    <User className="h-3 w-3" />
                                  </div>
                                )}
                              </div>

                            </div>
                          </div>

                          {/* Quick movement selectors for Mobile/Accessibility */}
                          <div className="flex justify-between mt-3.5 pt-2.5 border-t border-slate-850/30 md:hidden">
                            <button 
                              disabled={col.id === 'todo'}
                              onClick={() => {
                                const seq = ['todo', 'in-progress', 'review', 'done'];
                                const prevIdx = seq.indexOf(col.id) - 1;
                                if (prevIdx >= 0) handleUpdateStatus(task._id, seq[prevIdx]);
                              }}
                              className="p-1 hover:text-slate-100 text-slate-400 disabled:opacity-30 cursor-pointer transition-colors"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button 
                              disabled={col.id === 'done'}
                              onClick={() => {
                                const seq = ['todo', 'in-progress', 'review', 'done'];
                                const nextIdx = seq.indexOf(col.id) + 1;
                                if (nextIdx < seq.length) handleUpdateStatus(task._id, seq[nextIdx]);
                              }}
                              className="p-1 hover:text-slate-100 text-slate-400 disabled:opacity-30 cursor-pointer transition-colors"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

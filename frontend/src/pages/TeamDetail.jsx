import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { teamService } from '../services/teamService';
import { taskService } from '../services/taskService';
import { useToast } from '../hooks/useToast';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import WavePattern from '../components/common/WavePattern';
import {
  Users, Settings, Trash2, LogOut, Crown, UserCheck,
  UserX, ArrowUpDown, Copy, Check, User, Globe, Lock,
  RefreshCw, ChevronLeft, Search, Plus, MoreVertical,
  Calendar, Hash, Eye, Clock, CheckCircle, FileText,
  UserPlus, Flag, Edit3, ShieldAlert, CheckSquare, Square, Sparkles,
  Upload, Paperclip, File
} from 'lucide-react';

/* ── Helpers ── */
const roleMeta = {
  TEAM_LEADER: { label: 'Team Leader', cls: 'bg-blue-50 text-blue-700 border-blue-100', icon: Crown },
  MENTOR: { label: 'Mentor', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: UserCheck },
  MEMBER: { label: 'Member', cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: User },
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return 'May 18, 2026';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '2m ago';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ── Action Dropdown ── */
function ActionMenu({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30 animate-fade-in">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function formatActivityMessage(act) {
  const userName = act.user?.name || act.details?.userName || 'A member';
  const targetName = act.details?.targetName || 'a member';
  switch (act.action) {
    case 'TEAM_CREATED':
      return { text: `${userName} created the team`, icon: Flag, color: 'bg-blue-50 text-blue-600' };
    case 'TEAM_JOINED':
      return { text: `${userName} joined the team`, icon: UserPlus, color: 'bg-emerald-50 text-emerald-600' };
    case 'TEAM_LEFT':
      return { text: `${userName} left the team`, icon: LogOut, color: 'bg-rose-50 text-rose-600' };
    case 'MEMBER_REMOVED':
      return { text: `${userName} removed ${targetName}`, icon: UserX, color: 'bg-rose-50 text-rose-600' };
    case 'ROLE_UPDATED':
      return { text: `${userName} updated ${targetName}'s role to ${act.details?.newRole?.replace('_', ' ') || 'new role'}`, icon: ArrowUpDown, color: 'bg-amber-50 text-amber-600' };
    case 'LEADERSHIP_TRANSFERRED':
      return { text: `${userName} transferred leadership to ${act.details?.newLeaderName || 'new leader'}`, icon: Crown, color: 'bg-purple-50 text-purple-600' };
    case 'TEAM_UPDATED':
      return { text: `${userName} updated team settings`, icon: Settings, color: 'bg-slate-100 text-slate-600' };
    case 'JOIN_REQUEST_ACCEPTED':
      return { text: `${userName} accepted ${targetName || 'a member'}'s request to join`, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' };
    case 'JOIN_REQUEST_REJECTED':
      return { text: `${userName} rejected ${targetName || 'a member'}'s request to join`, icon: UserX, color: 'bg-slate-100 text-slate-500' };
    default:
      return { text: `${userName} performed an action`, icon: FileText, color: 'bg-slate-100 text-slate-600' };
  }
}

export default function TeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [teamActivities, setTeamActivities] = useState([]);
  const [teamProjects, setTeamProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  // UI states
  const [searchMember, setSearchMember] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Task completion modal states
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionFile, setCompletionFile] = useState('');
  const [submittingCompletion, setSubmittingCompletion] = useState(false);

  const handleOpenCompleteModal = (task) => {
    if (task.status === 'COMPLETED') {
      handleToggleTaskStatus(task._id, 'COMPLETED');
    } else {
      setTaskToComplete(task);
      setCompletionNotes('');
      setCompletionFile('');
      setCompleteModalOpen(true);
    }
  };

  const fileInputRef = useRef(null);
  const [uploadingReportFile, setUploadingReportFile] = useState(false);
  const [completionFileName, setCompletionFileName] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReportFile(true);
    setCompletionFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await taskService.uploadFile(formData);
      const data = res.data?.data ?? res.data;
      const serverUrl = data.url;
      setCompletionFile(serverUrl);
      success(`File "${file.name}" uploaded to server!`);
    } catch (err) {
      toastError(err.response?.data?.message || 'File upload failed');
    } finally {
      setUploadingReportFile(false);
    }
  };

  const updateLocalTaskState = (updatedTask, updatedProject) => {
    setTeamProjects(prevProjects =>
      prevProjects.map(proj => {
        const hasTask = proj.tasks?.some(t => t._id === updatedTask._id);
        if (proj._id === updatedTask.project || hasTask) {
          const newTasks = (proj.tasks || []).map(t => t._id === updatedTask._id ? updatedTask : t);
          const doneCount = newTasks.filter(t => t.status === 'COMPLETED').length;
          const newProgress = newTasks.length > 0 ? Math.round((doneCount / newTasks.length) * 100) : 0;
          return {
            ...proj,
            progress: updatedProject?.progress ?? newProgress,
            status: updatedProject?.status ?? (newProgress === 100 ? 'COMPLETED' : newProgress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'),
            tasks: newTasks
          };
        }
        return proj;
      })
    );
  };

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      const res = await taskService.updateTaskStatus(taskId, nextStatus);
      const data = res.data?.data ?? res.data;
      if (data?.task) {
        updateLocalTaskState(data.task, data.project);
      }
      success(`Task marked as ${nextStatus === 'COMPLETED' ? 'Completed' : 'Pending'}`);
      fetchTeam();
    } catch {
      toastError('Failed to update task status');
    }
  };

  const handleConfirmTaskCompletion = async (e) => {
    e.preventDefault();
    if (!taskToComplete) return;
    setSubmittingCompletion(true);
    try {
      const res = await taskService.updateTaskStatus(taskToComplete._id, 'COMPLETED', completionNotes, completionFile);
      const data = res.data?.data ?? res.data;
      if (data?.task) {
        updateLocalTaskState(data.task, data.project);
      }
      success(`Task "${taskToComplete.title}" completed! Progress report updated.`);
      setCompleteModalOpen(false);
      setTaskToComplete(null);
      fetchTeam();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to complete task');
    } finally {
      setSubmittingCompletion(false);
    }
  };

  useEffect(() => { fetchTeam(); }, [teamId]);

  const fetchTeam = async () => {
    try {
      // Fire team fetch first to get userRole, then fire the rest in parallel
      const res = await teamService.getById(teamId);
      const d = res.data?.data ?? res.data;
      setTeam(d.team);
      setMembers(d.members ?? []);
      setUserRole(d.userRole);
      setEditForm({
        name: d.team.name,
        description: d.team.description,
        visibility: d.team.visibility,
        allowJoinRequests: d.team.allowJoinRequests
      });

      // Run all remaining fetches in parallel
      const isLeaderOrMentor = ['TEAM_LEADER', 'MENTOR'].includes(d.userRole);
      const [projRes, actRes, reqRes] = await Promise.all([
        taskService.getProjects(teamId).catch(() => null),
        teamService.getActivities(teamId).catch(() => null),
        isLeaderOrMentor ? teamService.getJoinRequests(teamId).catch(() => null) : Promise.resolve(null),
      ]);

      if (projRes) setTeamProjects(projRes.data?.data ?? projRes.data ?? []);
      if (actRes) setTeamActivities(actRes.data?.data ?? actRes.data ?? []);
      if (reqRes) setJoinRequests(reqRes.data?.data ?? reqRes.data ?? []);

    } catch {
      navigate('/teams');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await teamService.update(teamId, editForm);
      success('Team settings saved!');
      fetchTeam();
      setShowEditModal(false);
    } catch (err) {
      toastError(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await teamService.delete(teamId);
      success('Team deleted.');
      navigate('/teams');
    } catch (err) {
      toastError(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleLeave = async () => {
    try {
      await teamService.leave(teamId);
      success('You left the team.');
      navigate('/teams');
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to leave team');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the team?')) return;
    try {
      await teamService.removeMember(teamId, memberId);
      success('Member removed.');
      fetchTeam();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await teamService.updateMemberRole(teamId, memberId, newRole);
      success(`Role updated to ${newRole.replace('_', ' ')}`);
      fetchTeam();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleTransfer = async (memberId) => {
    if (!window.confirm('Transfer leadership to this member?')) return;
    try {
      await teamService.transferLeadership(teamId, memberId);
      success('Leadership transferred!');
      fetchTeam();
    } catch (err) {
      toastError(err.response?.data?.message || 'Transfer failed');
    }
  };

  const handleRespondRequest = async (requestId, status) => {
    try {
      await teamService.respondJoinRequest(teamId, requestId, status);
      success(`Request ${status === 'ACCEPTED' ? 'accepted' : 'rejected'}`);
      fetchTeam();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to respond');
    }
  };

  const copyJoinCode = () => {
    navigator.clipboard.writeText(team.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const regenerateCode = async () => {
    try {
      const res = await teamService.regenerateCode(teamId);
      const d = res.data?.data ?? res.data;
      setTeam(prev => ({ ...prev, joinCode: d.joinCode }));
      success('Join code regenerated!');
    } catch {
      toastError('Failed to regenerate code');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size="lg" /></div>;
  if (!team) return null;

  const isLeader = userRole === 'TEAM_LEADER' || team.createdBy?._id === authUser?._id;
  const isMentor = userRole === 'MENTOR';
  const isMember = !!userRole;

  const leaderMember = members.find(m => m.role === 'TEAM_LEADER') || { user: team.createdBy || { name: 'Kshitiz Jain' } };
  const mentorCount = members.filter(m => m.role === 'MENTOR').length;

  const filteredMembers = members.filter(m => {
    const q = searchMember.toLowerCase();
    return (m.user?.name && m.user.name.toLowerCase().includes(q)) ||
      (m.user?.email && m.user.email.toLowerCase().includes(q));
  });

  const allTeamTasks = teamProjects.flatMap(p => p.tasks || []);

  const tabs = [
    { id: 'Overview', label: 'Overview' },
    { id: 'Tasks', label: 'Tasks & Progress', badge: allTeamTasks.length },
    { id: 'Members', label: 'Members', badge: members.length },
    { id: 'Requests', label: 'Requests', badge: (isLeader || isMentor) ? joinRequests.length : 0 },
    { id: 'Activity', label: 'Activity' },
    { id: 'Settings', label: 'Settings' },
  ];


  return (
    <div className="page-wrapper">
      {/* ── Breadcrumb Navigation ── */}
      <Link
        to="/teams"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition-colors group"
      >
        <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Teams
      </Link>

      {/* ── Header Banner ── */}
      <div className="card p-6 sm:p-8 mb-8 relative overflow-hidden bg-white border border-slate-200 shadow-sm">
        {/* Full header SVG wave background - seamlessly fades from middle to right edge without vertical cuts */}
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0">
          <WavePattern />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-6 min-w-0">
            {/* Team Logo Square Badge */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-600 text-white font-bold text-xl sm:text-2xl flex items-center justify-center flex-shrink-0 shadow-md">
              {team.logo ? (
                <img src={team.logo} alt="" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                getInitials(team.name)
              )}
            </div>

            {/* Team Header Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                  {team.name}
                </h1>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${team.visibility === 'PUBLIC'
                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                    : 'bg-slate-100 text-slate-700'
                  }`}>
                  {team.visibility === 'PUBLIC' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {team.visibility}
                </span>
              </div>

              <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
                {team.description || 'Building the future of our design language and component library to create consistent, accessible, and beautiful user experiences.'}
              </p>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500 font-medium mt-4 pt-4 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-400" />
                  <strong className="text-slate-800">{members.length}</strong> Members
                </span>
                <span className="flex items-center gap-1.5">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <strong className="text-slate-800">{leaderMember.user?.name || 'Leader'}</strong> (Leader)
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Created on {formatDate(team.createdAt)}
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Hash className="h-4 w-4 text-slate-400" />
                  Team Code: <strong className="text-slate-800 tracking-wider">{team.joinCode}</strong>
                  <button onClick={copyJoinCode} className="text-slate-400 hover:text-primary-600 transition-colors p-0.5" title="Copy code">
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons Top Right */}
          <div className="flex items-center gap-2 flex-shrink-0 self-start">
            {isLeader && (
              <button onClick={() => setShowEditModal(true)} className="btn-secondary btn-sm flex items-center gap-1.5">
                <Edit3 className="h-4 w-4" /> Edit Team
              </button>
            )}

            {/* More Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className="btn-secondary btn-sm flex items-center gap-1.5"
              >
                More <MoreVertical className="h-4 w-4 ml-0.5" />
              </button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMoreMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30 animate-fade-in">
                    <button
                      onClick={() => { setMoreMenuOpen(false); setShowInviteModal(true); }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-slate-400" /> Invite Member
                    </button>
                    {isLeader && (
                      <button
                        onClick={() => { setMoreMenuOpen(false); regenerateCode(); }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-slate-400" /> Regenerate Code
                      </button>
                    )}
                    {isMember && !isLeader && (
                      <button
                        onClick={() => { setMoreMenuOpen(false); setShowLeaveModal(true); }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Leave Team
                      </button>
                    )}
                    {isLeader && (
                      <button
                        onClick={() => { setMoreMenuOpen(false); setShowDeleteModal(true); }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Team
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Team Navigation Tabs ── */}
      <div className="border-b border-slate-200 mb-8">
        <nav className="flex gap-8 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                  ? 'text-primary-600'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${activeTab === tab.id ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full animate-fade-in" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab Views ── */}

      {/* ════════════ OVERVIEW TAB ════════════ */}
      {activeTab === 'Overview' && (
        <div className="space-y-8">
          {/* Top 2 Columns: Overview Grid + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left 3 cols: Team Overview (6 Stat Cards) */}
            <div className="lg:col-span-3 card">
              <h2 className="section-title mb-5">Team Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

                {/* Stat 1: Members */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                    <Users className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Members</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{members.length}</p>
                </div>

                {/* Stat 2: Team Leader */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                    <Crown className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Team Leader</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{leaderMember.user?.name || 'Leader'}</p>
                </div>

                {/* Stat 3: Mentors */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Mentors</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{mentorCount}</p>
                </div>

                {/* Stat 4: Visibility */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                    {team.visibility === 'PUBLIC' ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Visibility</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{team.visibility}</p>
                </div>

                {/* Stat 5: Created On */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Created On</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{formatDate(team.createdAt)}</p>
                </div>

                {/* Stat 6: Team Code */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center mb-2">
                      <Hash className="h-4 w-4" />
                    </div>
                    <button onClick={copyJoinCode} className="text-slate-400 hover:text-primary-600 transition-colors p-1">
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Team Code</p>
                  <p className="text-sm font-mono font-bold text-slate-900 mt-0.5 tracking-wider">{team.joinCode}</p>
                </div>

              </div>
            </div>

            {/* Right 2 cols: Recent Activity */}
            <div className="lg:col-span-2 card p-0 flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="section-title">Recent Activity</h2>
                <button
                  onClick={() => setActiveTab('Activity')}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  View all
                </button>
              </div>

              <div className="px-5 py-2 divide-y divide-slate-100 flex-1 flex flex-col justify-center">
                {teamActivities.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <CheckCircle className="h-9 w-9 mx-auto text-emerald-400/80 mb-2" />
                    <p className="font-semibold text-slate-700 text-xs">You're all caught up!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">No recent activity for this team.</p>
                  </div>
                ) : (
                  teamActivities.slice(0, 5).map((act) => {
                    const info = formatActivityMessage(act);
                    const IconComp = info.icon;
                    return (
                      <div key={act._id} className="flex items-start gap-3 py-3">
                        <div className={`w-7 h-7 rounded-lg ${info.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <IconComp className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 font-medium leading-tight">{info.text}</p>
                        </div>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(act.createdAt)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Bottom Full Row: Members Table */}
          <div className="card p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h2 className="section-title">Members</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  {members.length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    className="input pl-9 text-xs py-1.5 w-48 sm:w-60"
                    value={searchMember}
                    onChange={e => setSearchMember(e.target.value)}
                  />
                </div>
                <button onClick={() => setShowInviteModal(true)} className="btn-primary btn-sm text-xs flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Invite Member
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-6">Member</th>
                    <th className="py-3 px-6">Role</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Joined On</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMembers.map((m) => {
                    const meta = roleMeta[m.role] ?? roleMeta.MEMBER;
                    const isTargetLeader = m.role === 'TEAM_LEADER';

                    return (
                      <tr key={m._id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Member */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            {m.user?.avatar ? (
                              <img src={m.user.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                {getInitials(m.user?.name || m.user?.email)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-slate-900">{m.user?.name}</p>
                              <p className="text-slate-400 text-[11px]">{m.user?.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.cls}`}>
                            {isTargetLeader && <Crown className="h-3 w-3 text-blue-600" />}
                            {meta.label}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-6">
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </td>

                        {/* Joined On */}
                        <td className="py-3.5 px-6 text-slate-500 font-medium">
                          {formatDate(m.joinedAt)}
                        </td>

                        {/* Actions Dropdown */}
                        <td className="py-3.5 px-6 text-right">
                          {isLeader && !isTargetLeader && m.role !== 'MENTOR' ? (
                            <ActionMenu>
                              <button
                                onClick={() => handleTransfer(m.user._id)}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-primary-600 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Crown className="h-3.5 w-3.5" /> Transfer Leadership
                              </button>
                              <button
                                onClick={() => handleRemoveMember(m.user._id)}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                              >
                                <UserX className="h-3.5 w-3.5" /> Remove Member
                              </button>
                            </ActionMenu>
                          ) : (
                            <span className="text-slate-300">•</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ TASKS & PROGRESS TAB ════════════ */}
      {activeTab === 'Tasks' && (
        <div className="space-y-6 animate-fade-in">
          {teamProjects.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">
              <CheckCircle className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700 text-sm">No Projects or Tasks assigned yet</p>
              <p className="text-xs text-slate-400 mt-1">Mentor or Team Leader can assign tasks and projects to this team.</p>
            </div>
          ) : (
            teamProjects.map(proj => {
              const pTasks = proj.tasks || [];
              const doneCount = pTasks.filter(t => t.status === 'COMPLETED').length;
              const calcProgress = proj.progress !== undefined ? proj.progress : (pTasks.length > 0 ? Math.round((doneCount / pTasks.length) * 100) : 0);

              return (
                <div key={proj._id} className="card p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{proj.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${calcProgress === 100 ? 'bg-emerald-50 text-emerald-700' :
                            calcProgress > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                          {calcProgress === 100 ? 'COMPLETED' : calcProgress > 0 ? 'IN PROGRESS' : 'NOT STARTED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{proj.description || 'Team Project'}</p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
                      <span className="text-xs font-semibold text-slate-500">Project Progress:</span>
                      <span className="text-xl font-black text-blue-600">{calcProgress}%</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${calcProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 text-right">
                      {doneCount} of {pTasks.length} tasks completed ({pTasks.length > 0 ? Math.round(100 / pTasks.length) : 0}% per task)
                    </p>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Tasks</h4>
                    {pTasks.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No tasks in this project</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {pTasks.map(t => {
                          const isDone = t.status === 'COMPLETED';
                          return (
                            <div key={t._id} className="py-3 flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <button
                                  onClick={() => handleOpenCompleteModal(t)}
                                  className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                                >
                                  {isDone ? (
                                    <CheckSquare className="h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <Square className="h-5 w-5" />
                                  )}
                                </button>
                                <div>
                                  <p className={`text-sm font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                    {t.title}
                                  </p>
                                  {t.description && (
                                    <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                                  )}
                                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                                    <span>Assigned to: <strong className="text-slate-700">{t.assignedTo?.name || 'Entire Team'}</strong></span>
                                    {t.deadline && <span>Due: <strong>{new Date(t.deadline).toLocaleDateString()}</strong></span>}
                                    {isDone && t.completedBy && (
                                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                                        Completed by: {t.completedBy?.name || 'Team Member'}
                                      </span>
                                    )}
                                  </div>

                                  {isDone && (t.completionNotes || t.completionFile) && (
                                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                                      {t.completionNotes && (
                                        <p className="text-slate-700">
                                          <strong className="text-slate-900">Submitted Report:</strong> {t.completionNotes}
                                        </p>
                                      )}
                                      {t.completionFile && (
                                        <div className="pt-1">
                                          <a
                                            href={t.completionFile.startsWith('http') ? t.completionFile : `http://localhost:5000${t.completionFile}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-200"
                                          >
                                            <FileText className="h-4 w-4 text-blue-600" />
                                            View / Download Uploaded Report PDF ↗
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleOpenCompleteModal(t)}
                                className={`btn-sm text-xs font-bold rounded-lg px-3 py-1 flex-shrink-0 ${isDone ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'btn-primary'
                                  }`}
                              >
                                {isDone ? 'Completed ✓' : 'Complete & Submit Report'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════ MEMBERS TAB ════════════ */}
      {activeTab === 'Members' && (
        <div className="card p-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="section-title">Team Members Directory</h2>
              <p className="text-xs text-slate-400 mt-0.5">Manage roles and member permissions for this team.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="input pl-9 text-xs py-2 w-60"
                  value={searchMember}
                  onChange={e => setSearchMember(e.target.value)}
                />
              </div>
              <button onClick={() => setShowInviteModal(true)} className="btn-primary btn-sm flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Invite Member
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3.5 px-6">Member</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Joined On</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMembers.map((m) => {
                  const meta = roleMeta[m.role] ?? roleMeta.MEMBER;
                  const isTargetLeader = m.role === 'TEAM_LEADER';

                  return (
                    <tr key={m._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {m.user?.avatar ? (
                            <img src={m.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                              {getInitials(m.user?.name || m.user?.email)}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{m.user?.name}</p>
                            <p className="text-slate-400 text-xs">{m.user?.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}>
                          {isTargetLeader && <Crown className="h-3 w-3 text-blue-600" />}
                          {meta.label}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {formatDate(m.joinedAt)}
                      </td>

                      <td className="py-4 px-6 text-right">
                        {isLeader && !isTargetLeader && m.role !== 'MENTOR' ? (
                          <ActionMenu>
                            <button
                              onClick={() => handleTransfer(m.user._id)}
                              className="w-full px-4 py-2 text-left text-xs font-semibold text-primary-600 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Crown className="h-3.5 w-3.5" /> Transfer Leadership
                            </button>
                            <button
                              onClick={() => handleRemoveMember(m.user._id)}
                              className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                            >
                              <UserX className="h-3.5 w-3.5" /> Remove Member
                            </button>
                          </ActionMenu>
                        ) : (
                          <span className="text-slate-300">•</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ REQUESTS TAB ════════════ */}
      {activeTab === 'Requests' && (
        <div className="card p-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="section-title">Pending Join Requests</h2>
            <p className="text-xs text-slate-400 mt-0.5">Review and respond to candidate requests to join this team.</p>
          </div>

          {joinRequests.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <UserCheck className="h-12 w-12 mx-auto text-slate-200 mb-3" />
              <p className="font-semibold text-slate-600">No pending join requests</p>
              <p className="text-xs text-slate-400 mt-1">When someone requests to join using the join code, it will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {joinRequests.map(req => (
                <div key={req._id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {req.user?.avatar ? (
                      <img src={req.user.avatar} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
                        {getInitials(req.user?.name || req.user?.email)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{req.user?.name}</h4>
                      <p className="text-xs text-slate-400">{req.user?.email}</p>
                      {req.message && (
                        <p className="text-xs text-slate-600 bg-slate-100 rounded-lg p-2 mt-2 italic">"{req.message}"</p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">Requested {timeAgo(req.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleRespondRequest(req._id, 'REJECTED')}
                      className="btn-danger btn-sm text-xs"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleRespondRequest(req._id, 'ACCEPTED')}
                      className="btn-success btn-sm text-xs"
                    >
                      Accept Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════ ACTIVITY TAB ════════════ */}
      {activeTab === 'Activity' && (
        <div className="card">
          <h2 className="section-title mb-6">Team Activity Timeline</h2>
          {teamActivities.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle className="h-10 w-10 mx-auto text-emerald-400/80 mb-2" />
              <p className="font-semibold text-slate-700 text-sm">You're all caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No recent activity for this team.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {teamActivities.map((act) => {
                const info = formatActivityMessage(act);
                const IconComp = info.icon;
                return (
                  <div key={act._id} className="relative flex items-start gap-4">
                    <div className={`absolute -left-6 w-5 h-5 rounded-full ${info.color} flex items-center justify-center ring-4 ring-white`}>
                      <IconComp className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{info.text}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{timeAgo(act.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════ SETTINGS TAB ════════════ */}
      {activeTab === 'Settings' && (
        <div className="space-y-6 max-w-3xl">
          {/* General Settings Form */}
          <div className="card">
            <h2 className="section-title mb-4">General Settings</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">Team Name</label>
                <input
                  type="text"
                  className="input"
                  value={editForm.name ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  required
                  disabled={!isLeader}
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editForm.description ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  disabled={!isLeader}
                />
              </div>

              <div>
                <label className="label">Visibility</label>
                <select
                  className="input"
                  value={editForm.visibility ?? 'PUBLIC'}
                  onChange={e => setEditForm(p => ({ ...p, visibility: e.target.value }))}
                  disabled={!isLeader}
                >
                  <option value="PUBLIC">🌐 Public – searchable & open</option>
                  <option value="PRIVATE">🔒 Private – join code required</option>
                </select>
              </div>

              {isLeader && (
                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? <Loader size="sm" className="border-white/40 border-t-white" /> : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Regenerate Code */}
          {isLeader && (
            <div className="card flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Team Join Code</h3>
                <p className="text-xs text-slate-400 mt-0.5">Current code: <strong className="font-mono text-slate-700">{team.joinCode}</strong></p>
              </div>
              <button onClick={regenerateCode} className="btn-secondary btn-sm flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate Code
              </button>
            </div>
          )}

          {/* Danger Zone */}
          <div className="card border-rose-200 bg-rose-50/40">
            <h2 className="text-sm font-bold text-rose-700 mb-1 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Danger Zone
            </h2>
            <p className="text-xs text-slate-500 mb-4">Irreversible operations for this team.</p>

            <div className="flex flex-wrap items-center gap-3">
              {isMember && !isLeader && (
                <button onClick={() => setShowLeaveModal(true)} className="btn-danger btn-sm">
                  Leave Team
                </button>
              )}
              {isLeader && (
                <button onClick={() => setShowDeleteModal(true)} className="btn-danger btn-sm">
                  Delete Team Permanently
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Invite Member Modal */}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Member to Team">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Share this unique team code with your teammates to invite them to this team.</p>
          <div className="p-4 bg-slate-100 rounded-xl text-center">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Team Code</p>
            <p className="text-3xl font-mono font-bold text-blue-600 tracking-widest mt-1">{team.joinCode}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={copyJoinCode} className="btn-primary w-full flex items-center justify-center gap-2">
              {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Team Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Team Details">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="label">Team Name *</label>
            <input
              type="text"
              className="input"
              value={editForm.name ?? ''}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={3}
              value={editForm.description ?? ''}
              onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Visibility</label>
            <select
              className="input"
              value={editForm.visibility ?? 'PUBLIC'}
              onChange={e => setEditForm(p => ({ ...p, visibility: e.target.value }))}
            >
              <option value="PUBLIC">🌐 Public</option>
              <option value="PRIVATE">🔒 Private</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader size="sm" className="border-white/40 border-t-white" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Leave Team Confirmation Modal */}
      <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Leave Team">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Are you sure you want to leave <strong>{team.name}</strong>? You will lose access to team resources and member discussions.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowLeaveModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleLeave} className="btn-danger">Confirm Leave</button>
          </div>
        </div>
      </Modal>

      {/* ── Complete Task & Submit Report Modal ── */}
      <Modal isOpen={completeModalOpen} onClose={() => setCompleteModalOpen(false)} title={`Complete Task: ${taskToComplete?.title || ''}`}>
        <form onSubmit={handleConfirmTaskCompletion} className="space-y-4">
          <p className="text-xs text-slate-500">
            Completing this task will automatically update the team project progress percentage and notify your mentor and team leader.
          </p>

          <div>
            <label className="label">Work Summary / Completion Report *</label>
            <textarea
              className="input text-xs font-medium"
              rows={4}
              placeholder="Describe what was completed, key deliverables, or notes for your mentor..."
              value={completionNotes}
              onChange={e => setCompletionNotes(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Report Document / File Attachment (Optional)</label>

            {/* Hidden native File Explorer input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="input text-xs flex-1"
                placeholder="File name or URL (e.g. report.pdf)"
                value={completionFile}
                onChange={e => setCompletionFile(e.target.value)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs py-2.5 px-3 flex items-center gap-1.5 whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-bold"
              >
                <Upload className="h-4 w-4" />
                Browse File Explorer
              </button>
            </div>
            {completionFile && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <File className="h-3 w-3" /> Selected: {completionFile}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCompleteModalOpen(false)} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" disabled={submittingCompletion} className="btn-primary text-xs font-bold">
              {submittingCompletion ? <Loader size="sm" className="border-white/40 border-t-white" /> : 'Submit Report & Complete Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

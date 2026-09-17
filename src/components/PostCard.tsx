import React from 'react';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Plus, Repeat2, Send, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Post } from '../types';
import { useAppContext } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { CommentModal } from './comments/CommentModal';
import { HashtagParser } from './HashtagParser';
import { cn } from '../lib/utils';

interface Props { post: Post; isActive?: boolean; compact?: boolean; onHidePost?: (id: string) => void }
const format = (value = 0) => value >= 1_000_000 ? `${(value/1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value/1_000).toFixed(1)}K` : String(value);

export function PostCard({ post, isActive = true, compact = false, onHidePost }: Props) {
  const { currentUser, requireAuth, dispatchEvent, isGlobalMuted, setIsGlobalMuted } = useAppContext();
  const navigate = useNavigate();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = React.useState(Boolean(post.isLikedByMe));
  const [likes, setLikes] = React.useState(post.likesCount || 0);
  const [saved, setSaved] = React.useState(Boolean(post.isBookmarkedByMe));
  const [reposted, setReposted] = React.useState(false);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const author = post.author;
  const media = post.mediaUrl || post.content || `/api/posts/${post.id}/media`;
  const own = Boolean(currentUser && post.authorId === (currentUser.uid || currentUser.id));

  React.useEffect(() => { const video = videoRef.current; if (!video || post.type !== 'video') return; video.muted = isGlobalMuted; if (isActive) video.play().catch(() => { video.muted = true; setIsGlobalMuted(true); void video.play().catch(() => undefined); }); else { video.pause(); video.currentTime = 0; } }, [isActive, post.id, isGlobalMuted]);

  const like = () => requireAuth('Like', 'Sign in to like this Moment.', () => { const next = !liked; setLiked(next); setLikes(value => Math.max(0, value + (next ? 1 : -1))); dispatchEvent({ objectId: post.id, operation: next ? 'LIKE' : 'UNLIKE', payload: { targetType: 'POST' } }); });

  const bookmark = () => requireAuth('Save', 'Sign in to save this Moment.', async () => {
    const previous = saved; setSaved(!previous); setError('');
    try { const token = await auth.currentUser?.getIdToken(); const response = await fetch(`/api/posts/${post.id}/bookmark`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('Could not save this Moment'); const payload = await response.json(); setSaved(Boolean(payload.isBookmarked)); }
    catch (reason) { setSaved(previous); setError((reason as Error).message); }
  });

  const repost = () => { if (own) return setError('You cannot repost your own Moment.'); requireAuth('Repost', 'Sign in to repost this Moment.', async () => { const previous = reposted; setReposted(!previous); try { const token = await auth.currentUser?.getIdToken(); const response = await fetch(`/api/posts/${post.id}/repost`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('Repost failed'); } catch { setReposted(previous); setError('Repost failed. Try again.'); } }); };

  const share = async () => { const url = `${location.origin}/post/${post.id}`; try { if (navigator.share) await navigator.share({ title: author?.displayName ? `${author.displayName} on Omni` : 'A Moment on Omni', text: post.caption || '', url }); else await navigator.clipboard.writeText(url); } catch {} };

  const remove = () => { onHidePost?.(post.id); setMenuOpen(false); };
  return <article className={cn('relative overflow-hidden bg-black text-white', compact ? 'h-[65vh] rounded-[22px]' : 'h-full')}>
    <div className="absolute inset-0">{post.type === 'video' ? <video ref={videoRef} src={media} muted={isGlobalMuted} loop playsInline preload={isActive ? 'auto' : 'metadata'} className="h-full w-full object-cover" onClick={() => videoRef.current?.paused ? void videoRef.current.play() : videoRef.current?.pause()}/> : <img src={media} alt={post.caption || 'Moment'} className="h-full w-full object-cover"/>}<div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent via-50% to-black/90"/></div>
    <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 px-4 pb-20">
      <div className="min-w-0 flex-1 pb-2">{author && <button onClick={() => navigate(`/profile/${author.id}`)} className="mb-2 flex items-center gap-2 text-left"><span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/30 bg-white/10">{author.avatar ? <img src={author.avatar} alt="" className="h-full w-full object-cover"/> : (author.displayName || author.username || '?').slice(0,1)}</span><span><b className="block text-sm">{author.displayName || author.username}</b><span className="text-xs text-white/65">@{author.username}</span></span></button>} {post.caption && <p className="line-clamp-3 text-sm leading-5 text-white/95"><HashtagParser text={post.caption}/></p>}</div>
      <div className="flex shrink-0 flex-col items-center gap-3">{author && !own && <button onClick={event => { event.stopPropagation(); navigate(`/profile/${author.id}`); }} className="grid h-9 w-9 place-items-center rounded-full bg-omni-accent text-[#0b0b0a]" aria-label="View creator"><Plus size={17}/></button>}<RailButton label="Like" value={format(likes)} active={liked} onClick={like}><Heart fill={liked ? 'currentColor' : 'none'}/></RailButton><RailButton label="Comments" value={format(post.commentsCount)} onClick={() => requireAuth('Comments', 'Sign in to join the conversation.', () => setCommentsOpen(true))}><MessageCircle/></RailButton><RailButton label="Save" active={saved} onClick={bookmark}><Bookmark fill={saved ? 'currentColor' : 'none'}/></RailButton><RailButton label="Repost" active={reposted} value={format(post.repostsCount)} onClick={repost}><Repeat2/></RailButton><RailButton label="Share" onClick={share}><Send/></RailButton>{post.type === 'video' && <RailButton label={isGlobalMuted ? 'Muted' : 'Sound'} onClick={() => setIsGlobalMuted(!isGlobalMuted)}>{isGlobalMuted ? <VolumeX/> : <Volume2/>}</RailButton>}<RailButton label="More" onClick={() => setMenuOpen(true)}><MoreHorizontal/></RailButton></div>
    </div>
    {error && <button onClick={() => setError('')} className="absolute left-4 top-24 z-30 max-w-[80%] rounded-xl bg-black/80 px-3 py-2 text-left text-xs">{error}</button>}
    {menuOpen && <div className="fixed inset-0 z-[100] flex items-end bg-black/65" onClick={() => setMenuOpen(false)}><div className="w-full rounded-t-[28px] border-t border-white/10 bg-[var(--omni-bg-surface)] p-4" onClick={event => event.stopPropagation()}><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20"/><button onClick={share} className="min-h-12 w-full rounded-xl text-left text-sm">Share Moment</button><button onClick={bookmark} className="min-h-12 w-full rounded-xl text-left text-sm">{saved ? 'Remove from saved' : 'Save for later'}</button>{!own && <button onClick={remove} className="min-h-12 w-full rounded-xl text-left text-sm text-[var(--omni-warning)]">Show fewer Moments like this</button>}<button onClick={() => setMenuOpen(false)} className="mt-2 min-h-12 w-full rounded-xl bg-white/[0.07] text-sm font-semibold">Cancel</button></div></div>}
    {commentsOpen && <CommentModal postId={post.id} onClose={() => setCommentsOpen(false)}/>} 
  </article>;
}

function RailButton({ children, label, value, active, onClick }: { children: React.ReactNode; label: string; value?: string; active?: boolean; onClick: () => void }) { return <button onClick={event => { event.stopPropagation(); onClick(); }} aria-label={label} className={cn('flex min-w-11 flex-col items-center text-white drop-shadow-lg', active && 'text-omni-accent')}><span className="grid h-10 w-10 place-items-center rounded-full bg-black/25 backdrop-blur-sm [&>svg]:h-6 [&>svg]:w-6">{children}</span><span className="text-[10px] font-semibold">{value || label}</span></button>; }

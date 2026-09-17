import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Post, User, Comment } from '../types';

/**
 * Ensures the authenticated user document exists in Firestore and returns the canonical profile.
 */
export async function syncUserWithFirestore(
  firebaseUser: any,
  customData?: Partial<User>
): Promise<User> {
  if (!firebaseUser?.uid) {
    throw new Error('Valid Firebase user is required for sync');
  }

  const userDocRef = doc(db, 'users', firebaseUser.uid);
  let existingData: any = null;

  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      existingData = snap.data();
    }
  } catch (err) {
    console.warn('[Firestore] Could not fetch existing user doc, proceeding with fallback:', err);
  }

  const baseUsername = (
    customData?.username ||
    existingData?.username ||
    firebaseUser.displayName?.toLowerCase().replace(/\s+/g, '') ||
    'user_' + firebaseUser.uid.substring(0, 6)
  );

  const finalUser: User = {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email || existingData?.email || undefined,
    username: baseUsername,
    displayName: customData?.displayName || existingData?.displayName || firebaseUser.displayName || 'Creator',
    avatar: customData?.avatar || existingData?.avatar || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
    bio: customData?.bio || existingData?.bio || "Discover, follow, and build connections with the world's best creators on Omni.",
    followersCount: existingData?.followersCount ?? 0,
    followingCount: existingData?.followingCount ?? 0,
    createdAt: existingData?.createdAt || new Date().toISOString(),
  };

  try {
    // Upsert user doc into Firestore
    await setDoc(userDocRef, finalUser, { merge: true });
  } catch (writeErr) {
    console.warn('[Firestore] Note: Could not write user document to Firestore:', writeErr);
  }

  return finalUser;
}

/**
 * Fetches a user document by userId (or username) from Firestore.
 */
export async function getFirestoreUser(userId: string): Promise<User | null> {
  if (!userId) return null;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        uid: snap.id,
        ...data,
      } as User;
    }

    // Attempt username search
    const q = query(collection(db, 'users'), where('username', '==', userId), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const docSnap = querySnap.docs[0];
      return {
        id: docSnap.id,
        uid: docSnap.id,
        ...docSnap.data(),
      } as User;
    }
  } catch (err) {
    console.warn('[Firestore] Error fetching user:', err);
  }
  return null;
}

/**
 * Updates a user document in Firestore.
 */
export async function updateFirestoreUser(userId: string, updates: Partial<User>): Promise<void> {
  if (!userId) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, updates as any);
  } catch (err) {
    console.warn('[Firestore] Error updating user:', err);
  }
}

/**
 * Fetches the feed from Firestore.
 */
export async function getFirestoreFeed(
  tab: 'foryou' | 'following' = 'foryou',
  currentUserId?: string,
  limitCount = 20
): Promise<Post[]> {
  try {
    const postsRef = collection(db, 'posts');
    let q;

    if (tab === 'following' && currentUserId) {
      // Find following IDs
      try {
        const followsQuery = query(collection(db, 'follows'), where('followerId', '==', currentUserId));
        const followsSnap = await getDocs(followsQuery);
        const followingIds = followsSnap.docs.map((d) => d.data().followingId);
        followingIds.push(currentUserId);

        if (followingIds.length > 0) {
          q = query(
            postsRef,
            where('authorId', 'in', followingIds.slice(0, 10)),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
          );
        } else {
          q = query(postsRef, orderBy('createdAt', 'desc'), limit(limitCount));
        }
      } catch {
        q = query(postsRef, orderBy('createdAt', 'desc'), limit(limitCount));
      }
    } else {
      q = query(postsRef, orderBy('createdAt', 'desc'), limit(limitCount));
    }

    const snap = await getDocs(q);
    const posts: Post[] = [];

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Record<string, any>;
      // Only include public posts for general feed
      if (data.visibility && data.visibility === 'private' && data.authorId !== currentUserId) {
        continue;
      }

      let author: User = data.author;
      if (!author && data.authorId) {
        const authorUser = await getFirestoreUser(data.authorId);
        if (authorUser) author = authorUser;
      }

      posts.push({
        id: docSnap.id,
        authorId: data.authorId || '',
        author: author || {
          id: data.authorId || 'creator',
          username: 'creator',
          displayName: 'Creator',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.authorId || 'creator'}`,
        },
        type: data.type || 'video',
        content: data.content || data.mediaUrl || '',
        mediaUrl: data.mediaUrl || data.content || '',
        thumbnailUrl: data.thumbnailUrl || data.mediaUrl || '',
        caption: data.caption || '',
        tags: Array.isArray(data.tags) ? data.tags.join(' ') : (data.tags || ''),
        visibility: data.visibility || 'public',
        allowComments: data.allowComments !== false,
        likesCount: data.likesCount || 0,
        commentsCount: data.commentsCount || 0,
        repostsCount: data.repostsCount || 0,
        sharesCount: data.sharesCount || 0,
        viewsCount: data.viewsCount || 0,
        createdAt: data.createdAt || new Date().toISOString(),
        isPinned: Boolean(data.isPinned),
        isLikedByMe: false,
      });
    }

    return posts;
  } catch (err) {
    console.warn('[Firestore] Error fetching feed:', err);
    return [];
  }
}

/**
 * Fetches user posts from Firestore.
 */
export async function getFirestoreUserPosts(
  userId: string,
  tab: 'created' | 'private' | 'liked' | 'saved' = 'created',
  currentUserId?: string
): Promise<Post[]> {
  try {
    const isMe = currentUserId === userId;
    const postsRef = collection(db, 'posts');

    if (tab === 'created') {
      const q = query(
        postsRef,
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            authorId: data.authorId || userId,
            type: data.type || 'video',
            content: data.content || data.mediaUrl || '',
            mediaUrl: data.mediaUrl || data.content || '',
            thumbnailUrl: data.thumbnailUrl || data.mediaUrl || '',
            caption: data.caption || '',
            tags: Array.isArray(data.tags) ? data.tags.join(' ') : (data.tags || ''),
            visibility: data.visibility || 'public',
            allowComments: data.allowComments !== false,
            likesCount: data.likesCount || 0,
            commentsCount: data.commentsCount || 0,
            repostsCount: data.repostsCount || 0,
            sharesCount: data.sharesCount || 0,
            viewsCount: data.viewsCount || 0,
            createdAt: data.createdAt || new Date().toISOString(),
            isPinned: Boolean(data.isPinned),
          } as Post;
        })
        .filter((p) => isMe || p.visibility !== 'private');
    }

    if (tab === 'private' && isMe) {
      const q = query(
        postsRef,
        where('authorId', '==', userId),
        where('visibility', '==', 'private'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        return {
          id: docSnap.id,
          authorId: data.authorId || userId,
          type: data.type || 'video',
          content: data.content || data.mediaUrl || '',
          mediaUrl: data.mediaUrl || data.content || '',
          thumbnailUrl: data.thumbnailUrl || data.mediaUrl || '',
          caption: data.caption || '',
          visibility: 'private',
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
          repostsCount: data.repostsCount || 0,
          sharesCount: data.sharesCount || 0,
          viewsCount: data.viewsCount || 0,
          createdAt: data.createdAt || new Date().toISOString(),
        } as Post;
      });
    }

    return [];
  } catch (err) {
    console.warn('[Firestore] Error fetching user posts:', err);
    return [];
  }
}

/**
 * Creates a post in Firestore.
 */
export async function createFirestorePost(postData: Partial<Post> & { author: User }): Promise<Post> {
  const docRef = doc(collection(db, 'posts'));
  const newPost: Post = {
    id: docRef.id,
    authorId: postData.authorId || postData.author.id,
    author: postData.author,
    type: postData.type || 'video',
    content: postData.mediaUrl || postData.content || '',
    mediaUrl: postData.mediaUrl || '',
    thumbnailUrl: postData.thumbnailUrl || postData.mediaUrl || '',
    caption: postData.caption || '',
    tags: typeof postData.tags === 'string' ? postData.tags : (postData.tags ? (postData.tags as any).join(' ') : ''),
    visibility: (postData.visibility as any) || 'public',
    allowComments: postData.allowComments !== false,
    likesCount: 0,
    commentsCount: 0,
    repostsCount: 0,
    sharesCount: 0,
    viewsCount: 0,
    createdAt: new Date().toISOString(),
    isPinned: false,
    isLikedByMe: false,
  };

  await setDoc(docRef, newPost);
  return newPost;
}

/**
 * Toggles like on a post in Firestore.
 */
export async function toggleFirestoreLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<{ liked: boolean; likesCount: number }> {
  try {
    const postRef = doc(db, 'posts', postId);
    const likeRef = doc(db, 'posts', postId, 'likes', userId);

    if (currentlyLiked) {
      await deleteDoc(likeRef);
      await updateDoc(postRef, { likesCount: increment(-1) });
      return { liked: false, likesCount: -1 };
    } else {
      await setDoc(likeRef, { userId, createdAt: new Date().toISOString() });
      await updateDoc(postRef, { likesCount: increment(1) });
      return { liked: true, likesCount: 1 };
    }
  } catch (err) {
    console.warn('[Firestore] Error toggling like:', err);
    return { liked: !currentlyLiked, likesCount: currentlyLiked ? -1 : 1 };
  }
}

/**
 * Toggles pin status on a post in Firestore.
 */
export async function toggleFirestorePin(postId: string, isPinned: boolean): Promise<boolean> {
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, { isPinned });
    return true;
  } catch (err) {
    console.warn('[Firestore] Error toggling pin:', err);
    return false;
  }
}

/**
 * Fetches comments for a post from Firestore.
 */
export async function getFirestoreComments(postId: string): Promise<Comment[]> {
  try {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      postId,
      ...d.data(),
    })) as Comment[];
  } catch (err) {
    console.warn('[Firestore] Error fetching comments:', err);
    return [];
  }
}

/**
 * Adds a comment to a post in Firestore.
 */
export async function addFirestoreComment(
  postId: string,
  author: User,
  text: string
): Promise<Comment> {
  const commentRef = doc(collection(db, 'posts', postId, 'comments'));
  const newComment: Comment = {
    id: commentRef.id,
    postId,
    authorId: author.id,
    author,
    text,
    likesCount: 0,
    createdAt: new Date().toISOString(),
    replyCount: 0,
  };

  await setDoc(commentRef, newComment);
  try {
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
  } catch {}

  return newComment;
}

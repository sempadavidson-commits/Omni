import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { ArrowLeft } from 'lucide-react';
import { Post } from '../types';

export function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setPost(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  return (
    <div className="flex flex-col h-full bg-black relative">
      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-4 left-4 z-50 p-2 bg-black/50 backdrop-blur-md rounded-full text-white"
      >
        <ArrowLeft size={24} />
      </button>
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white">Loading...</div>
      ) : post ? (
        <div className="flex-1 h-full w-full">
          <PostCard post={post} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500">Post not found</div>
      )}
    </div>
  );
}

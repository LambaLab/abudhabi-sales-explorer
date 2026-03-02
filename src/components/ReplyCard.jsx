import { UserBubble } from './UserBubble'
import { AIBubble }   from './AIBubble'

export function ReplyCard({ reply, onReply, postId }) {
  return (
    <div className="space-y-3">
      <UserBubble prompt={reply.prompt} createdAt={reply.createdAt} />
      <AIBubble reply={reply} onReply={onReply} postId={postId} />
    </div>
  )
}

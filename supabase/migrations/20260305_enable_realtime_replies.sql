-- Enable Supabase Realtime for the replies table so that INSERT events
-- are broadcast to all subscribed clients via the existing useFeed channel.
ALTER PUBLICATION supabase_realtime ADD TABLE replies;

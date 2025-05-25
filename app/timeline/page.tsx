import { getServerSupabaseClient } from '../lib/supabase-server'
import { redirect } from 'next/navigation'
import Timeline from './Timeline'

export default async function TimelinePage() {
  try {
    const supabase = getServerSupabaseClient()
    
    // Check if we have a session
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    console.log('Session check:', { 
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message 
    })

    if (sessionError) {
      console.error('Session error:', sessionError)
      return <div>Error checking authentication</div>
    }

    if (!session) {
      redirect('/login')
    }

    // Fetch stories server-side
    const { data: stories, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })

    console.log('Stories fetch:', {
      count: stories?.length,
      error: error?.message,
      firstStory: stories?.[0]
    })

    if (error) {
      console.error('Error fetching stories:', error)
      return <div>Error loading stories: {error.message}</div>
    }

    return <Timeline initialStories={stories || []} />
  } catch (error) {
    console.error('Unexpected error in TimelinePage:', error)
    return <div>An unexpected error occurred</div>
  }
} 
import SessionExamInterface from '@/components/exam/SessionExamInterface'

interface ExamPageProps {
	params: Promise<{ id: string }>
}

export default async function ExamPage({ params }: ExamPageProps) {
	const { id } = await params

	return <SessionExamInterface examId={id} />
}
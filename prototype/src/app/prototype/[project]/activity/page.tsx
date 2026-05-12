import { Activity } from '../../../../../../prototypes/dashboard-northstar/pages/Activity';

export default async function Page(props: { params: Promise<{ project: string }> }) {
  const { project } = await props.params;
  return <Activity projectId={project} />;
}

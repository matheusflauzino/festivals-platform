import { CreateGradeCriterionForm } from './create-grade-criterion-form';

export default async function NewGradeCriterionPage(
  props: PageProps<'/festivals/[festivalId]/stages/[stageId]/grade-criteria/new'>,
) {
  const { festivalId, stageId } = await props.params;
  return <CreateGradeCriterionForm stageId={stageId} festivalId={festivalId} />;
}

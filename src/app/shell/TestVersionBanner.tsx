export const TEST_VERSION_WARNING =
  'Versão de teste - o BemTeVi não realiza diagnóstico e não substitui atendimento profissional.';

export function TestVersionBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-200 px-container-padding-mobile py-2 text-center font-label-md text-amber-950">
      {TEST_VERSION_WARNING}
    </div>
  );
}

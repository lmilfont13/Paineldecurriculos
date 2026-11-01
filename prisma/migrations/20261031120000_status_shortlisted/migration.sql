-- Nova etapa do funil: candidato que passou da triagem, antes da entrevista.
ALTER TYPE "AppStatus" ADD VALUE IF NOT EXISTS 'SHORTLISTED' BEFORE 'INTERVIEW';

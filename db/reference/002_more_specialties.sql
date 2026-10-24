-- Additional specialties (idempotent). Run after 001_reference_data.sql; safe to re-run.
-- REVIEW against the CMD / Dirección General de Residencias Médicas list before launch: no single official
-- list could be sourced, so this follows common medical specialties plus programs named in DR news (Medicina Interna,
-- Anestesiología, Nefrología, Neumología, Cirugía Vascular, Neurocirugía, Oculoplastia...). Drop rows you do not want.
-- schema_enum is NULL when schema.org has no matching MedicalSpecialty term: we never guess.

alter table specialties alter column schema_enum drop not null;

insert into specialties (slug, name_singular, name_plural, field_name, agent_f, agent_m, schema_enum, icon) values
 ('internistas','Medicina interna','Internistas','Medicina interna','internista','internista',null,'stethoscope'),
 ('medicos-familiares','Medicina familiar','Médicos familiares','Medicina familiar','médica familiar','médico familiar','PrimaryCare','stethoscope'),
 ('anestesiologos','Anestesiología','Anestesiólogos','Anestesiología','anestesióloga','anestesiólogo','Anesthesia','stethoscope'),
 ('traumatologos','Traumatología','Traumatólogos','Traumatología','traumatóloga','traumatólogo','Musculoskeletal','bone'),
 ('neurocirujanos','Neurocirugía','Neurocirujanos','Neurocirugía','neurocirujana','neurocirujano','Surgical','brain'),
 ('cirujanos-cardiovasculares','Cirugía cardiovascular','Cirujanos cardiovasculares','Cirugía cardiovascular','cirujana cardiovascular','cirujano cardiovascular','Surgical','heart'),
 ('cirujanos-vasculares','Cirugía vascular','Cirujanos vasculares','Cirugía vascular','cirujana vascular','cirujano vascular','Surgical','heart'),
 ('cirujanos-toracicos','Cirugía torácica','Cirujanos torácicos','Cirugía torácica','cirujana torácica','cirujano torácico','Surgical','lungs'),
 ('cirujanos-pediatricos','Cirugía pediátrica','Cirujanos pediátricos','Cirugía pediátrica','cirujana pediátrica','cirujano pediátrico','Surgical','baby'),
 ('cirujanos-oncologos','Cirugía oncológica','Cirujanos oncólogos','Cirugía oncológica','cirujana oncóloga','cirujano oncólogo','Oncologic','stethoscope'),
 ('cirujanos-bariatricos','Cirugía bariátrica','Cirujanos bariátricos','Cirugía bariátrica','cirujana bariátrica','cirujano bariátrico','Surgical','stethoscope'),
 ('cirujanos-de-mano','Cirugía de mano','Cirujanos de mano','Cirugía de mano','cirujana de mano','cirujano de mano','Surgical','bone'),
 ('coloproctologos','Coloproctología','Coloproctólogos','Coloproctología','coloproctóloga','coloproctólogo','Surgical','stethoscope'),
 ('hepatologos','Hepatología','Hepatólogos','Hepatología','hepatóloga','hepatólogo','Gastroenterologic','stethoscope'),
 ('hematologos','Hematología','Hematólogos','Hematología','hematóloga','hematólogo','Hematologic','stethoscope'),
 ('infectologos','Infectología','Infectólogos','Infectología','infectóloga','infectólogo','Infectious','stethoscope'),
 ('alergologos','Alergología e inmunología','Alergólogos','Alergología e inmunología','alergóloga','alergólogo',null,'sparkle'),
 ('diabetologos','Diabetología','Diabetólogos','Diabetología','diabetóloga','diabetólogo','Endocrine','stethoscope'),
 ('mastologos','Mastología','Mastólogos','Mastología','mastóloga','mastólogo',null,'stethoscope'),
 ('radiooncologos','Radioterapia oncológica','Radiooncólogos','Radioterapia oncológica','radiooncóloga','radiooncólogo','Oncologic','stethoscope'),
 ('obstetras','Obstetricia','Obstetras','Obstetricia','obstetra','obstetra','Obstetric','flower'),
 ('especialistas-en-fertilidad','Medicina reproductiva y fertilidad','Especialistas en fertilidad','Medicina reproductiva y fertilidad','especialista en fertilidad','especialista en fertilidad','Gynecologic','flower'),
 ('neonatologos','Neonatología','Neonatólogos','Neonatología','neonatóloga','neonatólogo','Pediatric','baby'),
 ('geneticistas','Genética médica','Genetistas','Genética médica','genetista','genetista','Genetic','stethoscope'),
 ('intensivistas','Medicina crítica y cuidados intensivos','Intensivistas','Medicina crítica y cuidados intensivos','intensivista','intensivista',null,'stethoscope'),
 ('emergenciologos','Medicina de emergencias','Emergenciólogos','Medicina de emergencias','emergencióloga','emergenciólogo','Emergency','stethoscope'),
 ('fisiatras','Medicina física y rehabilitación','Fisiatras','Medicina física y rehabilitación','fisiatra','fisiatra',null,'bone'),
 ('medicos-del-deporte','Medicina del deporte','Médicos del deporte','Medicina del deporte','médica del deporte','médico del deporte',null,'bone'),
 ('radiologos','Radiología e imágenes','Radiólogos','Radiología e imágenes','radióloga','radiólogo',null,'stethoscope'),
 ('patologos','Patología','Patólogos','Patología','patóloga','patólogo','Pathology','stethoscope'),
 ('medicos-estetica','Medicina estética','Médicos de medicina estética','Medicina estética','médica estética','médico estético',null,'sparkle'),
 ('odontologos','Odontología general','Odontólogos','Odontología general','odontóloga','odontólogo','Dentistry','tooth'),
 ('ortodoncistas','Ortodoncia','Ortodoncistas','Ortodoncia','ortodoncista','ortodoncista','Dentistry','tooth'),
 ('endodoncistas','Endodoncia','Endodoncistas','Endodoncia','endodoncista','endodoncista','Dentistry','tooth'),
 ('periodoncistas','Periodoncia','Periodoncistas','Periodoncia','periodoncista','periodoncista','Dentistry','tooth'),
 ('cirujanos-maxilofaciales','Cirugía maxilofacial','Cirujanos maxilofaciales','Cirugía maxilofacial','cirujana maxilofacial','cirujano maxilofacial','Dentistry','tooth'),
 ('podologos','Podología','Podólogos','Podología','podóloga','podólogo','Podiatric','bone'),
 ('psicologos','Psicología clínica','Psicólogos','Psicología clínica','psicóloga','psicólogo',null,'brain')
on conflict (slug) do nothing;

-- Profession of the non-physician specialties (the column comes from migration 008). Safe to re-run.
update specialties set profession = 'odontologo' where slug in ('odontologos', 'ortodoncistas', 'endodoncistas', 'periodoncistas', 'cirujanos-maxilofaciales');
update specialties set profession = 'psicologo' where slug = 'psicologos';

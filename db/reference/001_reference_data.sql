-- Reference data for production (idempotent). Run after db/migrations/001_core.sql.
-- REVIEW before launch: ARS names against the current SISALRIL list; add sectors as doctors require them.

insert into specialties (slug, name_singular, name_plural, field_name, agent_f, agent_m, schema_enum, icon) values
 ('cardiologos','Cardiología','Cardiólogos','Cardiología','cardióloga','cardiólogo','Cardiovascular','heart'),
 ('pediatras','Pediatría','Pediatras','Pediatría','pediatra','pediatra','Pediatric','baby'),
 ('ginecologos','Ginecología','Ginecólogos','Ginecología','ginecóloga','ginecólogo','Gynecologic','flower'),
 ('dermatologos','Dermatología','Dermatólogos','Dermatología','dermatóloga','dermatólogo','Dermatology','sparkle'),
 ('medicos-generales','Medicina general','Médicos generales','Medicina general','médica general','médico general','PrimaryCare','stethoscope'),
 ('ortopedas','Ortopedia','Ortopedas','Ortopedia','ortopeda','ortopeda','Musculoskeletal','bone'),
 ('oftalmologos','Oftalmología','Oftalmólogos','Oftalmología','oftalmóloga','oftalmólogo','Optometric','eye'),
 ('neurologos','Neurología','Neurólogos','Neurología','neuróloga','neurólogo','Neurologic','brain'),
 ('urologos','Urología','Urólogos','Urología','uróloga','urólogo','Urologic','stethoscope'),
 ('endocrinologos','Endocrinología','Endocrinólogos','Endocrinología','endocrinóloga','endocrinólogo','Endocrine','stethoscope'),
 ('gastroenterologos','Gastroenterología','Gastroenterólogos','Gastroenterología','gastroenteróloga','gastroenterólogo','Gastroenterologic','stethoscope'),
 ('otorrinolaringologos','Otorrinolaringología','Otorrinolaringólogos','Otorrinolaringología','otorrinolaringóloga','otorrinolaringólogo','Otolaryngologic','stethoscope'),
 ('psiquiatras','Psiquiatría','Psiquiatras','Psiquiatría','psiquiatra','psiquiatra','Psychiatric','brain'),
 ('neumologos','Neumología','Neumólogos','Neumología','neumóloga','neumólogo','Pulmonary','stethoscope'),
 ('reumatologos','Reumatología','Reumatólogos','Reumatología','reumatóloga','reumatólogo','Rheumatologic','bone'),
 ('oncologos','Oncología','Oncólogos','Oncología','oncóloga','oncólogo','Oncologic','stethoscope'),
 ('nefrologos','Nefrología','Nefrólogos','Nefrología','nefróloga','nefrólogo','Renal','stethoscope'),
 ('cirujanos-plasticos','Cirugía plástica','Cirujanos plásticos','Cirugía plástica','cirujana plástica','cirujano plástico','PlasticSurgery','sparkle'),
 ('cirujanos-generales','Cirugía general','Cirujanos generales','Cirugía general','cirujana general','cirujano general','Surgical','stethoscope'),
 ('nutriologos','Nutrición','Nutriólogos','Nutrición','nutrióloga','nutriólogo','DietNutrition','stethoscope'),
 ('geriatras','Geriatría','Geriatras','Geriatría','geriatra','geriatra','Geriatric','stethoscope')
on conflict (slug) do nothing;

insert into cities (slug, name, province) values
 ('santo-domingo','Santo Domingo','Distrito Nacional'),
 ('santo-domingo-este','Santo Domingo Este','Santo Domingo'),
 ('santo-domingo-oeste','Santo Domingo Oeste','Santo Domingo'),
 ('santo-domingo-norte','Santo Domingo Norte','Santo Domingo'),
 ('santiago','Santiago','Santiago'),
 ('la-romana','La Romana','La Romana'),
 ('san-pedro-de-macoris','San Pedro de Macorís','San Pedro de Macorís'),
 ('punta-cana','Punta Cana','La Altagracia'),
 ('puerto-plata','Puerto Plata','Puerto Plata'),
 ('san-cristobal','San Cristóbal','San Cristóbal'),
 ('la-vega','La Vega','La Vega'),
 ('higuey','Higüey','La Altagracia'),
 ('san-francisco-de-macoris','San Francisco de Macorís','Duarte'),
 ('bavaro','Bávaro','La Altagracia'),
 ('sosua','Sosúa','Puerto Plata')
on conflict (slug) do nothing;

insert into sectors (slug, name, city_id)
select s.slug, s.name, c.id from (values
 ('piantini','Piantini','santo-domingo'), ('naco','Naco','santo-domingo'), ('gazcue','Gazcue','santo-domingo'),
 ('evaristo-morales','Evaristo Morales','santo-domingo'), ('bella-vista','Bella Vista','santo-domingo'),
 ('arroyo-hondo','Arroyo Hondo','santo-domingo'), ('serralles','Serrallés','santo-domingo'), ('la-esperilla','La Esperilla','santo-domingo'),
 ('mirador-sur','Mirador Sur','santo-domingo'), ('zona-colonial','Zona Colonial','santo-domingo'), ('ensanche-julieta','Ensanche Julieta','santo-domingo'),
 ('los-jardines','Los Jardines Metropolitanos','santiago'), ('centro-santiago','Centro de Santiago','santiago'), ('cerros-de-gurabo','Cerros de Gurabo','santiago')
) as s(slug, name, city_slug) join cities c on c.slug = s.city_slug
on conflict (city_id, slug) do nothing;

insert into ars (slug, name) values
 ('humano','ARS Humano'), ('universal','ARS Universal'), ('senasa','SeNaSa'), ('mapfre-salud','Mapfre Salud'),
 ('reservas','ARS Reservas'), ('monumental','ARS Monumental'), ('futuro','ARS Futuro'), ('yunen','ARS Yunén'),
 ('palic','ARS Palic Salud'), ('cmd','ARS CMD'), ('renacer','ARS Renacer'), ('simag','ARS Simag')
on conflict (slug) do nothing;

-- =============================================================================
-- Reference and sample data for the demo.
-- [Source] classes 6-12, four versions, three groups, demo subjects Bangla /
--          English / Mathematics for classes 9-10 (Rakib, 22-23 Nov 2026).
-- [Inferred] the rest of the class 9-10 subject list follows the NCTB SSC
--          structure; the real list is set by the admin (Guideline §7-খ).
-- [Sample]  package prices, notices and live schedule are placeholders for the
--          UI-only screens; no payment is taken.
-- Safe to run more than once.
-- =============================================================================

insert into public.classes (id, name_bn, name_en) values
  (6, 'ষষ্ঠ শ্রেণি', 'Class 6'), (7, 'সপ্তম শ্রেণি', 'Class 7'), (8, 'অষ্টম শ্রেণি', 'Class 8'),
  (9, 'নবম শ্রেণি', 'Class 9'), (10, 'দশম শ্রেণি', 'Class 10'),
  (11, 'একাদশ শ্রেণি', 'Class 11'), (12, 'দ্বাদশ শ্রেণি', 'Class 12')
on conflict (id) do update set name_bn = excluded.name_bn, name_en = excluded.name_en;

insert into public.groups (code, name_bn, name_en, sort) values
  ('science', 'বিজ্ঞান', 'Science', 1),
  ('commerce', 'ব্যবসায় শিক্ষা', 'Business Studies', 2),
  ('arts', 'মানবিক', 'Humanities', 3)
on conflict (code) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, sort = excluded.sort;

insert into public.versions (code, name_bn, name_en, sort) values
  ('bangla', 'বাংলা ভার্সন', 'Bangla Version', 1),
  ('english_version', 'ইংলিশ ভার্সন', 'English Version', 2),
  ('english_medium', 'ইংলিশ মিডিয়াম', 'English Medium', 3),
  ('madrasa', 'মাদ্রাসা', 'Madrasa', 4)
on conflict (code) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, sort = excluded.sort;

-- Subjects -------------------------------------------------------------------
with catalogue (code, name_bn, name_en, group_code, sort, versions) as (values
  -- the three demo subjects, every version
  ('bangla-1',   'বাংলা ১ম পত্র',            'Bangla 1st Paper',              null::public.group_code, 1,  array['bangla','english_version','english_medium','madrasa']),
  ('bangla-2',   'বাংলা ২য় পত্র',            'Bangla 2nd Paper',              null, 2,  array['bangla','english_version','english_medium','madrasa']),
  ('english-1',  'ইংরেজি ১ম পত্র',           'English 1st Paper',             null, 3,  array['bangla','english_version','english_medium','madrasa']),
  ('english-2',  'ইংরেজি ২য় পত্র',           'English 2nd Paper',             null, 4,  array['bangla','english_version','english_medium','madrasa']),
  ('math',       'সাধারণ গণিত',             'General Mathematics',           null, 5,  array['bangla','english_version','english_medium','madrasa']),
  -- other NCTB subjects [Inferred], Bangla and English Version only
  ('ict',        'তথ্য ও যোগাযোগ প্রযুক্তি', 'ICT',                           null, 6,  array['bangla','english_version']),
  ('bgs',        'বাংলাদেশ ও বিশ্বপরিচয়',    'Bangladesh and Global Studies', null, 7,  array['bangla','english_version']),
  ('religion',   'ধর্ম ও নৈতিক শিক্ষা',       'Religion and Moral Education',  null, 8,  array['bangla','english_version']),
  ('physics',    'পদার্থবিজ্ঞান',            'Physics',                       'science', 10, array['bangla','english_version']),
  ('chemistry',  'রসায়ন',                   'Chemistry',                     'science', 11, array['bangla','english_version']),
  ('biology',    'জীববিজ্ঞান',               'Biology',                       'science', 12, array['bangla','english_version']),
  ('higher-math','উচ্চতর গণিত',              'Higher Mathematics',            'science', 13, array['bangla','english_version']),
  ('accounting', 'হিসাববিজ্ঞান',             'Accounting',                    'commerce', 10, array['bangla','english_version']),
  ('finance',    'ফিন্যান্স ও ব্যাংকিং',       'Finance and Banking',           'commerce', 11, array['bangla','english_version']),
  ('business',   'ব্যবসায় উদ্যোগ',           'Business Entrepreneurship',     'commerce', 12, array['bangla','english_version']),
  ('history',    'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', 'History of Bangladesh and World Civilisation', 'arts', 10, array['bangla','english_version']),
  ('geography',  'ভূগোল ও পরিবেশ',            'Geography and Environment',     'arts', 11, array['bangla','english_version']),
  ('civics',     'পৌরনীতি ও নাগরিকতা',        'Civics and Citizenship',        'arts', 12, array['bangla','english_version']),
  ('economics',  'অর্থনীতি',                  'Economics',                     'arts', 13, array['bangla','english_version'])
)
insert into public.subjects (class_id, version, group_code, code, name_bn, name_en, sort)
select c.id, v::public.version_code, cat.group_code, cat.code, cat.name_bn, cat.name_en, cat.sort
from catalogue cat
cross join (values (9::smallint), (10::smallint)) as c(id)
cross join unnest(cat.versions) as v
on conflict (class_id, version, code) do update
  set name_bn = excluded.name_bn, name_en = excluded.name_en, group_code = excluded.group_code, sort = excluded.sort;

-- Settings (Admin → Settings) ------------------------------------------------
insert into public.settings (key, value) values
  ('exam_attempts_per_day', '3'),          -- [Source] Rakib
  ('unlock_percent', '50'),                -- [Source] Rakib
  ('default_mcq_count', '10'),             -- [Source]
  ('default_written_count', '2'),          -- [Source]
  ('default_exam_minutes', '15'),          -- [Source]
  ('tutor_daily_limit', '30'),             -- [Proposed]
  ('question_review_required', 'false'),   -- [Proposed]
  ('max_answer_images', '4')               -- [Proposed]
on conflict (key) do nothing;

-- UI-only paid services [Sample] -----------------------------------------------
insert into public.packages (service, name_bn, name_en, price_bdt, period_days, sort)
select * from (values
  ('live'::public.paid_service, 'লাইভ ক্লাস মাসিক', 'Live Classes monthly', 300, 30::smallint, 1::smallint),
  ('ssc_prep', 'এসএসসি প্রস্তুতি মাসিক', 'SSC Preparation monthly', 500, 30, 2),
  ('hsc_prep', 'এইচএসসি প্রস্তুতি মাসিক', 'HSC Preparation monthly', 500, 30, 3)
) as p(service, name_bn, name_en, price_bdt, period_days, sort)
where not exists (select 1 from public.packages);

insert into public.notices (title_bn, title_en, body_bn, body_en)
select * from (values
  ('ডেমো প্ল্যাটফর্মে স্বাগতম', 'Welcome to the demo platform',
   'সবার জন্য ডিজিটাল দূরশিক্ষণের ডেমো সংস্করণ চালু হয়েছে। এখন নবম ও দশম শ্রেণির বাংলা, ইংরেজি ও গণিতের পাঠ পাওয়া যাবে।',
   'The demo of Digital Distance Learning for All is live. Class 9 and 10 Bangla, English and Mathematics lessons are available.')
) as n(title_bn, title_en, body_bn, body_en)
where not exists (select 1 from public.notices);

insert into public.live_classes (kind, class_id, subject_id, title, starts_at, duration_minutes)
select x.kind, 10, s.id, x.title, date_trunc('day', now() at time zone 'Asia/Dhaka') + x.offset_ + interval '0 hour', 60
from (values
  ('live'::public.paid_service, 'math', 'বীজগাণিতিক রাশি: প্রশ্নোত্তর', interval '1 day 19 hours'),
  ('ssc_prep', 'english-2', 'SSC English: Paragraph writing', interval '2 days 20 hours')
) as x(kind, code, title, offset_)
join public.subjects s on s.code = x.code and s.class_id = 10 and s.version = 'bangla'
where not exists (select 1 from public.live_classes);

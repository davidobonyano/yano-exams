-- Insert Nigerian standard classes
INSERT INTO public.classes (name, level, description) VALUES
('Junior Secondary School 1', 'JSS1', 'First year of junior secondary education'),
('Junior Secondary School 2', 'JSS2', 'Second year of junior secondary education'),
('Junior Secondary School 3', 'JSS3', 'Third year of junior secondary education - BECE preparation'),
('Senior Secondary School 1', 'SS1', 'First year of senior secondary education'),
('Senior Secondary School 2', 'SS2', 'Second year of senior secondary education'),
('Senior Secondary School 3', 'SS3', 'Final year of secondary education - WAEC/NECO preparation');

-- Insert sample exams
INSERT INTO public.exams (title, description, class_level, duration_minutes, total_questions, passing_score) VALUES
('JSS1 Mathematics Mid-Term Exam', 'Basic mathematics covering numbers, fractions, and basic geometry', 'JSS1', 90, 20, 50),
('JSS1 English Language Test', 'Grammar, comprehension, and basic writing skills', 'JSS1', 60, 15, 60),
('JSS2 Basic Science Exam', 'Introduction to physics, chemistry, and biology concepts', 'JSS2', 80, 25, 55),
('JSS3 Mathematics BECE Practice', 'Comprehensive mathematics test for BECE preparation', 'JSS3', 120, 40, 65),
('SS1 Physics Test', 'Mechanics, heat, and light', 'SS1', 90, 30, 50),
('SS2 Chemistry Exam', 'Organic and inorganic chemistry', 'SS2', 100, 35, 55),
('SS3 English WAEC Practice', 'Comprehensive English test for WAEC preparation', 'SS3', 180, 50, 70);

-- Get exam IDs for inserting questions
DO $$
DECLARE
    jss1_math_exam_id UUID;
    jss1_english_exam_id UUID;
    jss2_science_exam_id UUID;
    jss3_math_exam_id UUID;
    ss1_physics_exam_id UUID;
    ss2_chemistry_exam_id UUID;
    ss3_english_exam_id UUID;
BEGIN
    -- Get exam IDs
    SELECT id INTO jss1_math_exam_id FROM public.exams WHERE title = 'JSS1 Mathematics Mid-Term Exam';
    SELECT id INTO jss1_english_exam_id FROM public.exams WHERE title = 'JSS1 English Language Test';
    SELECT id INTO jss2_science_exam_id FROM public.exams WHERE title = 'JSS2 Basic Science Exam';
    SELECT id INTO jss3_math_exam_id FROM public.exams WHERE title = 'JSS3 Mathematics BECE Practice';
    SELECT id INTO ss1_physics_exam_id FROM public.exams WHERE title = 'SS1 Physics Test';
    SELECT id INTO ss2_chemistry_exam_id FROM public.exams WHERE title = 'SS2 Chemistry Exam';
    SELECT id INTO ss3_english_exam_id FROM public.exams WHERE title = 'SS3 English WAEC Practice';

    -- JSS1 Mathematics Questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (jss1_math_exam_id, 'What is 15 + 23?', 'multiple_choice', '{"A": "38", "B": "35", "C": "40", "D": "33"}', 'A', 1, '15 + 23 = 38'),
    (jss1_math_exam_id, 'What is 7 × 8?', 'multiple_choice', '{"A": "54", "B": "56", "C": "58", "D": "52"}', 'B', 1, '7 × 8 = 56'),
    (jss1_math_exam_id, 'What is 1/2 + 1/4?', 'multiple_choice', '{"A": "2/6", "B": "2/8", "C": "3/4", "D": "1/6"}', 'C', 1, '1/2 + 1/4 = 2/4 + 1/4 = 3/4'),
    (jss1_math_exam_id, 'How many sides does a triangle have?', 'multiple_choice', '{"A": "2", "B": "3", "C": "4", "D": "5"}', 'B', 1, 'A triangle has 3 sides by definition'),
    (jss1_math_exam_id, 'What is 100 ÷ 5?', 'multiple_choice', '{"A": "15", "B": "25", "C": "20", "D": "30"}', 'C', 1, '100 ÷ 5 = 20');

    -- JSS1 English Questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (jss1_english_exam_id, 'Choose the correct spelling:', 'multiple_choice', '{"A": "recieve", "B": "receive", "C": "recive", "D": "receave"}', 'B', 1, 'The correct spelling is "receive"'),
    (jss1_english_exam_id, 'What is the plural of "child"?', 'multiple_choice', '{"A": "childs", "B": "childes", "C": "children", "D": "child"}', 'C', 1, 'The plural of "child" is "children"'),
    (jss1_english_exam_id, 'Which is a noun?', 'multiple_choice', '{"A": "run", "B": "quickly", "C": "table", "D": "happy"}', 'C', 1, '"Table" is a noun - a thing'),
    (jss1_english_exam_id, 'Complete: "I ___ to school every day."', 'multiple_choice', '{"A": "goes", "B": "go", "C": "going", "D": "gone"}', 'B', 1, '"I go" is the correct present tense form');

    -- JSS2 Basic Science Questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (jss2_science_exam_id, 'What is the chemical symbol for water?', 'multiple_choice', '{"A": "H2O", "B": "HO2", "C": "H2O2", "D": "HO"}', 'A', 1, 'Water is H2O - two hydrogen atoms and one oxygen atom'),
    (jss2_science_exam_id, 'Which organ pumps blood in the human body?', 'multiple_choice', '{"A": "Lungs", "B": "Heart", "C": "Liver", "D": "Kidney"}', 'B', 1, 'The heart pumps blood throughout the body'),
    (jss2_science_exam_id, 'What happens to water when it boils?', 'multiple_choice', '{"A": "It becomes ice", "B": "It becomes vapor", "C": "It becomes solid", "D": "Nothing happens"}', 'B', 1, 'When water boils, it turns into water vapor (gas)'),
    (jss2_science_exam_id, 'How many legs does an insect have?', 'multiple_choice', '{"A": "4", "B": "6", "C": "8", "D": "10"}', 'B', 1, 'Insects have 6 legs');

    -- SS1 Physics Questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (ss1_physics_exam_id, 'What is the SI unit of force?', 'multiple_choice', '{"A": "Joule", "B": "Newton", "C": "Watt", "D": "Pascal"}', 'B', 1, 'Newton (N) is the SI unit of force'),
    (ss1_physics_exam_id, 'Which of the following is a vector quantity?', 'multiple_choice', '{"A": "Speed", "B": "Mass", "C": "Velocity", "D": "Temperature"}', 'C', 1, 'Velocity has both magnitude and direction, making it a vector'),
    (ss1_physics_exam_id, 'What is the acceleration due to gravity on Earth?', 'multiple_choice', '{"A": "9.8 m/s²", "B": "10 m/s²", "C": "8.9 m/s²", "D": "11 m/s²"}', 'A', 1, 'Standard acceleration due to gravity is 9.8 m/s²');

    -- SS2 Chemistry Questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (ss2_chemistry_exam_id, 'What is the atomic number of carbon?', 'multiple_choice', '{"A": "4", "B": "6", "C": "8", "D": "12"}', 'B', 1, 'Carbon has 6 protons, so its atomic number is 6'),
    (ss2_chemistry_exam_id, 'Which gas is most abundant in the atmosphere?', 'multiple_choice', '{"A": "Oxygen", "B": "Carbon dioxide", "C": "Nitrogen", "D": "Hydrogen"}', 'C', 1, 'Nitrogen makes up about 78% of the atmosphere'),
    (ss2_chemistry_exam_id, 'What type of bond exists in NaCl?', 'multiple_choice', '{"A": "Covalent", "B": "Ionic", "C": "Metallic", "D": "Hydrogen"}', 'B', 1, 'NaCl has an ionic bond between Na+ and Cl- ions');

    -- SS3 English Questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (ss3_english_exam_id, 'In the sentence "The book on the table is mine", what is the subject?', 'multiple_choice', '{"A": "book", "B": "table", "C": "The book on the table", "D": "mine"}', 'C', 1, 'The complete subject is "The book on the table"'),
    (ss3_english_exam_id, 'Which of these is a complex sentence?', 'multiple_choice', '{"A": "I went home.", "B": "I went home and slept.", "C": "When I went home, I slept.", "D": "Go home now."}', 'C', 1, 'A complex sentence has an independent and dependent clause'),
    (ss3_english_exam_id, 'What is the synonym of "abundant"?', 'multiple_choice', '{"A": "scarce", "B": "plentiful", "C": "limited", "D": "empty"}', 'B', 1, '"Plentiful" means the same as "abundant"');

END $$;
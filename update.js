const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walkDir(filePath, callback);
      }
    } else {
      callback(filePath);
    }
  });
}

let sessionUpdated = false;
let resultUpdated = false;

walkDir(path.join(__dirname, 'src'), (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Fix Session Submit Page
  if (filePath.includes('session') && filePath.endsWith('page.tsx')) {
    const newFunction = `  const handleFinalSubmit = useCallback(async () => {
    if (isFinalizing.current) return;
    isFinalizing.current = true;
    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = userId || user?.id;

    if (!currentUserId) {
      setIsSubmitting(false);
      isFinalizing.current = false;
      return;
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let totalScore = 0;

    questions.forEach((q) => {
      const studentAns = candidateAnswers[q.id];

      if (!studentAns || !studentAns.selected_answer) {
        unattemptedCount++;
      } else {
        const given = String(studentAns.selected_answer).trim().toUpperCase();
        const correct = String(q.correct_answer).trim().toUpperCase();

        if (given === correct) {
          correctCount++;
          totalScore += Number(q.positive_marks || 4);
        } else {
          incorrectCount++;
          totalScore -= Number(q.negative_marks || 1);
        }
      }
    });

    const { error } = await supabase.from('submissions').upsert({
      student_id: currentUserId,
      test_id: examId,
      total_score: totalScore,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unattempted_count: unattemptedCount,
      answers: candidateAnswers,
      status: 'completed',
      submitted_at: new Date().toISOString()
    }, { onConflict: 'student_id, test_id' });

    if (error) {
      console.error("Submission error:", error.message);
      setIsSubmitting(false);
      isFinalizing.current = false;
    } else {
      router.push(\`/test/\${examId}/result\`);
    }
  }, [userId, examId, questions, candidateAnswers, router]);`;

    const startIndex = content.indexOf('const handleFinalSubmit = useCallback(');
    if (startIndex !== -1) {
      let bracketCount = 0;
      let foundStart = false;
      let endIndex = -1;

      for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '(') {
          bracketCount++;
          foundStart = true;
        } else if (content[i] === ')') {
          bracketCount--;
        }
        
        if (foundStart && bracketCount === 0) {
          endIndex = i + 1;
          if (content[endIndex] === ';') {
            endIndex++;
          }
          break;
        }
      }

      if (endIndex !== -1) {
        content = content.slice(0, startIndex) + newFunction + content.slice(endIndex);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('SUCCESS: Updated session submission logic in:', filePath);
        sessionUpdated = true;
      }
    }
  }

  // 2. Fix Result / Scorecard Pages
  if (filePath.includes('result') && filePath.endsWith('page.tsx')) {
    let updated = content;
    updated = updated.replace(/\.eq\s*\(\s*['"]exam_id['"]\s*,/g, ".eq('test_id',");
    updated = updated.replace(/\.eq\s*\(\s*['"]user_id['"]\s*,/g, ".eq('student_id',");
    updated = updated.replace(/\bscore\b/g, "total_score");

    if (updated !== content) {
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log('SUCCESS: Updated result page database queries in:', filePath);
      resultUpdated = true;
    }
  }
});

if (sessionUpdated || resultUpdated) {
  console.log('ALL FIXES APPLIED SUCCESSFULLY!');
} else {
  console.log('Notice: Target files were already updated or paths differ slightly, check project structure.');
}
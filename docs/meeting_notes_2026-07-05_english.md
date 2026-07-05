# **Meeting Notes**

July 5, 2026

## **Meeting started on July 5, 2026 at 10:57 JST**

Meeting record: [Transcript](https://docs.google.com/document/d/1mPbnX9n9cXR_dh8N0YVY9zvmXnG6fAJoJTeSlCeuRLY/edit?usp=drive_web&tab=t.qm0zc2teoclf) [Recording](https://drive.google.com/file/d/19hRaqBtripSC4ftKHnDTM1KCJkwfiwoS/view?usp=drive_web)

### **Overview**

The group agreed on a direction for developing an integrated platform that converts legacy materials into formats that can be used effectively with AI.

**Importance of legacy data conversion**  
Documents in legacy formats have become a bottleneck for AI usage, and efficient data conversion is needed. The process of converting documents into formats that AI models can read easily is a challenge faced by many companies.

**Correction interface to compensate for imperfect accuracy**  
Because there are limits to the accuracy of automatic conversion, the group discussed that a unified UI where humans can verify and correct the output is essential. Advanced correction functions are required to properly handle diagrams, tables, and text.

**Decision to develop an integrated platform**  
The group decided to develop a product that automatically converts documents and provides a verification UI where humans can correct mistakes. The direction was set to prioritize the value of the output delivered to users over infrastructure.

### **Next Steps**

- [ ] [Hayato Toyoda] Share materials: Share sample Excel and PowerPoint files in Slack.

- [ ] [Group] Design the conversion tool: Design an interface that converts documents into Markdown or similar formats and allows humans to verify and correct the results.

- [ ] [Group] Build the web app: Develop a platform with a centralized interface where AI can read various existing media types and humans can correct the results.

- [ ] [Group] Provide process know-how: Provide concrete procedures and know-how inside the platform for converting existing specifications into formats that AI can read.

### **Details**

* **Testing the live translation function**: At the beginning of the meeting, the participants tested a live translation tool to see whether speech input was accurately converted into English or Japanese. Takumi Ueno confirmed that translation worked smoothly when the Wi-Fi environment was good, and worked with Eitaro Yamatsuta to set up an environment where real-time translation could be displayed during the meeting ([00:00:08](#00:00:08)).

* **Proposal for document conversion toward AI-driven development**: Hayato Toyoda raised the issue that, in many large enterprises, existing specifications and documents are managed in Word or PowerPoint formats, which has become a bottleneck that prevents AI-driven development. To solve this issue, he proposed building a platform that converts these formats into Markdown or other formats that are easier for AI to read ([00:04:02](#00:04:02)).

* **Concept of a browser for AI**: Eitaro Yamatsuta proposed the idea of a "browser for AI" that transforms web pages into a text-based network structure, making them lightweight and efficiently accessible by agents. The participants discussed the benefit of improving AI processing efficiency by excluding heavy video data and unnecessary elements ([00:08:19](#00:08:19)).

* **Presentation of new development ideas**: Takumi Ueno presented three main directions. The first was a document-preparation support tool that uses MCP (Model Context Protocol) or similar technologies to make government paperwork processes more efficient. The second was a web app that dynamically provides educational content based on each learner's situation and preferences. The third was strengthening a software forge that improves the performance of existing models, such as the "Fugu" model, and adjusts them into forms that are easier for users to use ([00:12:33](#00:12:33)).

* **Challenges in legacy data conversion**: Hayato Toyoda and Takumi Ueno discussed the challenge that even when current AI tools, such as Claude or Codex, are used, diagrams, tables, context, and missing information inside Word and PowerPoint files are not read accurately. For this reason, they agreed that what is needed is not just simple conversion, but also a process for checking whether the converted content is correct ([00:13:56](#00:13:56)).

* **Technical approach and use of search APIs**: The participants considered an approach using APIs like Firecrawl, which render websites in Markdown format and pass information to AI in a searchable form. They confirmed that using these tools could make it possible to build an environment where various agents can process information ([00:21:11](#00:21:11)).

* **Importance of verification for AI-generated outputs**: Hayato Toyoda emphasized that, more than the document conversion itself, the important part is the interface that verifies the accuracy of the converted information and corrects incorrect parts. The group discussed the need for a mechanism where the system points out omissions or misinterpretations, humans correct and approve them, and the final result becomes data that AI can handle easily ([00:23:40](#00:23:40)).

* **Clarifying the project direction and focus**: As a result of the discussion, the participants shared a direction of developing a platform that supports human correction and verification in addition to automatic conversion by existing AI models. The goal became to provide a solution that safely migrates the legacy-system documents held by large enterprises into formats that AI can use ([00:27:05](#00:27:05)) ([00:44:05](#00:44:05)).

* **Proof of concept for document conversion**: During the meeting, the group conducted an experiment to convert a document containing a complex AWS microservices architecture diagram into Mermaid or SVG format. As a result, they again recognized that although it is possible to code diagrams using an LLM, an advanced UI is essential for checking whether the generated content matches the original intent and for correcting it ([00:38:39](#00:38:39)) ([00:51:37](#00:51:37)).

* **Consideration of a GUI-based interface**: Takumi Ueno, Eitaro Yamatsuta, and Hayato Toyoda discussed user-facing editing functions using a GUI. Eitaro Yamatsuta questioned whether efficiency would really improve if humans ultimately need to intervene, given that existing tools such as Draw.io already exist. As a result of the discussion, the group shared the issue that there is a lack of an "all-in-one" interface where humans can intervene and correct many different media types, such as graphs, text, spreadsheets, and receipts ([00:55:21](#00:55:21)).

* **Proposal for developing an integrated platform**: In response to the problem raised by Rami Naeem, Takumi Ueno proposed that, given the current reality that AI models still cannot fully understand context, a unified UI/UX is needed for human intervention. The participants acknowledged the current situation where separate tools are required for different use cases, such as Draw.io and Mermaid, and agreed to develop a platform that integrates them and could become a company's "brain" ([00:59:09](#00:59:09)).

* **Providing know-how for conversion into AI-readable formats**: Hayato Toyoda pointed out that the core issue is not only the UI, but also that many users do not understand the process of converting existing specifications into formats that AI can read. The participants agreed that it would be effective to make the platform not just a tool, but also something that provides know-how for such conversion processes ([00:59:09](#00:59:09)).

* **MVP and system priorities**: Takumi Ueno and Hayato Toyoda discussed the concept of the MVP, or minimum viable product. They concluded that the final outcome, meaning the output result users receive, is more important than building infrastructure or a system architecture like AWS. They agreed that the most important question is not which infrastructure to use, but what kind of output to show users ([01:02:25](#01:02:25)).

* **Implementation of automatic conversion and human correction functions**: The participants defined the core function of the product to be developed. When a user uploads a PDF or PowerPoint, it is automatically converted, and for parts where AI recognition accuracy is imperfect, for example around 80% accurate, the product provides a dedicated UI where the user can check and correct the results. The group confirmed that this product is what will solve many current problems and agreed to proceed with development ([01:02:25](#01:02:25)).

*Please verify the accuracy of the notes generated by Gemini. [Tips and mechanism for notes generated by Gemini](https://support.google.com/meet/answer/14754931)*

***How was the quality of these notes?** Please provide feedback through this [short survey](https://google.qualtrics.com/jfe/form/SV_9vK3UZEaIQKKE7A?confid=TDwaEnCBPLCbuvsMobCjDxITOAIIigIgABgECA&detailid=standard&screenshot=false), including whether the notes met your needs.*

# **Transcript**

July 5, 2026

## **Meeting started on July 5, 2026 at 10:57 JST - Transcript**

Translation note: The original transcript was computer-generated and contains mixed Japanese, English, repeated live-translation fragments, and garbled recognition errors. The translation below preserves the structure, speaker turns, and timestamps. Clear Japanese has been translated into English; unintelligible fragments are rendered as `[unclear]` or preserved as broken English where that best reflects the source.

### **00:00:08** {#00:00:08}

**Takumi Ueno:** live translation really mayor comp M level Google Meet in the may the in the

**Eitaro Yamatsuta:** Hello.

**Takumi Ueno:** The captions are appearing where you can hear me...

**Eitaro Yamatsuta:** Japanese from Japanese to English, English to Japanese... I have not really used it much.

**Takumi Ueno:** I have not either. Also, the connection this time is really bad.

**Eitaro Yamatsuta:** I do not really know.

**Takumi Ueno:** Ah, the Wi-Fi connection is a little... I am on my smartphone. Ah, this connects. It is moving really smoothly. English.

**Eitaro Yamatsuta:** Maybe it does not work if you set Japanese to English.

**Takumi Ueno:** Ah, right. When I speak Japanese, why does this become English? Show language captions.

**Eitaro Yamatsuta:** Ah, here...

**Takumi Ueno:** When I speak Japanese like this, it seems like the translation is happening live now, so it might work. When I am speaking like this, it would be best if Rami sees it in English. How does it look?

**Eitaro Yamatsuta:** [unclear]

**Takumi Ueno:** Hello. I am speaking in Japanese. Can you hear me?

**Eitaro Yamatsuta:** Ah, yes.

**Takumi Ueno:** I am speaking in Japanese. I am really looking forward to lunch today. Since today was basically the first time I met [unclear], I was a little nervous, but I learned a lot from hearing various things through Bias and chat.

### **00:04:02** {#00:04:02}

**Eitaro Yamatsuta:** Ah, it may have appeared.

**Takumi Ueno:** Oh, I am really sleepy today. I could not sleep very much.

**Eitaro Yamatsuta:** I think need no right one this gears this gear and, ah, and...

**Takumi Ueno:** Nice. It connected. There it is. Hey.

**Eitaro Yamatsuta:** the bom I think Ja

**Takumi Ueno:** I am speaking Japanese, and I would be very happy if this is translated. Is it live? I am speaking Japanese like this. I am really wondering what to eat for lunch. Let's go. Let's go. [unclear]

**Eitaro Yamatsuta:** Ja

**Takumi Ueno:** So first, but a little...

**Hayato Toyoda:** Ah, then, can you hear this? Is it okay? So, one of the ideas for my computer-use theme is that, right now, office Word documents and PowerPoint documents are...

**Eitaro Yamatsuta:** Ah, A.

**Hayato Toyoda:** They have become quite difficult for AI to read, and, how should I put it...

**Eitaro Yamatsuta:** [unclear]

**Hayato Toyoda:** Sorry. Not text. Domain knowledge is becoming a bottleneck, and I think there are quite a few companies that are suffering from not being able to develop existing systems together with AI. Especially at the company where I work...

### **00:06:47**

**Hayato Toyoda:** The existing specifications they have used until now...

**Eitaro Yamatsuta:** [unclear]

**Hayato Toyoda:** Because they have been managed in Word or PowerPoint, even if people try to do AI-driven development, information that is only written in those specifications, or information that cannot be read from code, becomes a bottleneck. I think there are quite a few large companies that are unable to take the step toward AI-driven development. So I am thinking a little about some kind of platform or software that can convert Word or PowerPoint into MD files, HTML files, or some other form that AI can read easily.

**Eitaro Yamatsuta:** Right.

**Hayato Toyoda:** If it is just simple conversion, then rough conversion can already be done to some extent with existing tools like Codex or Claude Code. But there are still issues such as information being omitted, or, in PowerPoint, AI not being able to understand what diagrams and tables represent...

**Eitaro Yamatsuta:** Yes.

**Hayato Toyoda:** ...and therefore not being able to convert that properly into MD. So I think it would be nice to have an app where, in the final checking step, it properly shows items like, "information is missing here" or "the meaning of this diagram has not been read here," and then a human checks each one at the end, resulting in a perfect MD file. Yes. Thank you. Mm-hmm.

### **00:08:19** {#00:08:19}

**Eitaro Yamatsuta:** The final part, yes.

**Hayato Toyoda:** [unclear]

**Takumi Ueno:** B.

**Hayato Toyoda:** A.

**Eitaro Yamatsuta:** Ah.

**Takumi Ueno:** Should we go next?

**Eitaro Yamatsuta:** Ah. Am I next?

**Takumi Ueno:** Yes, please.

**Eitaro Yamatsuta:** I like the idea of what I have been wondering about: a Google browser for agents, where every web page is...

**Takumi Ueno:** For...

**Eitaro Yamatsuta:** ...transformed into a wiki-like, link-based network in a kind of interface, just text links and not...

**Takumi Ueno:** A to...

**Eitaro Yamatsuta:** ...heavy, right, and speed, speed.

**Takumi Ueno:** Ja.

**Eitaro Yamatsuta:** I do not think we need video for agents.

**Takumi Ueno:** Agents need it.

**Eitaro Yamatsuta:** Agents do not need YouTube; people need YouTube.

**Takumi Ueno:** Yes.

**Eitaro Yamatsuta:** [unclear] need videos.

**Takumi Ueno:** than so m...

**Eitaro Yamatsuta:** So...

**Takumi Ueno:** I have about three solutions. When I go to a city office and they do not know what they need, and it takes... um, first...

**Eitaro Yamatsuta:** The first one is about preparing administrative documents. When I moved or in situations like that, the staff at the counter has to handle documents every time...

### **00:12:33** {#00:12:33}

**Takumi Ueno:** The first one is government-office-related. When I moved or in similar situations, the staff at the counter had to handle documents every time, and that takes a lot of time. I also feel like, "Do I really have to do this every time?" So if the counter staff could connect to MCP or something, and based on the conversation with the customer, the system could say, "You need this document," and then connect to the customer's My Number information so that the customer's information is already filled in, leaving only "please fill in here, here, and here," I think it would be great if paperwork at city halls and similar places disappeared. I think that would fall under the dynamic software interface area. Another one is a web app for learning. This is also one type of dynamic software interface. When people want to study English or programming, until now they have had to receive fixed education through books or YouTube. It would be nice to have software that dynamically presents various things depending on each user's learning situation and preferences. There may already be a few products like this, but I thought it would be interesting if we could create a more interesting version of that. The last one is about the model called Fugu, which the AI team released. This would fall under the software forge area. If there are things where we want to improve Fugu further, depending on what is needed, we could use Gemini, ChatGPT, Gemini's Nano Banana, and so on to make something that is easier for users to understand. Building the base for that could also be good. Yes. Thank you. Given that, are there any comments on each other? One thing I thought is that, in traditional companies and unified accounting systems, those problems are still not solved. Maybe we can...

### **00:13:56** {#00:13:56}

**Eitaro Yamatsuta:** [unclear]

**Takumi Ueno:** ...merge those two ideas together and provide a solution. That might be a good idea. That is the comment I have. Are there any remarks? Ja. Mm. Comments, Ito-san?

**Eitaro Yamatsuta:** Right. Ah, I will speak a little in Japanese. For the accountant idea, I am not in a global company, so I cannot concretely imagine the problem, for example, the differences that arise each time between accounting in the U.S. and Japan.

**Takumi Ueno:** Accounting, yes.

**Eitaro Yamatsuta:** I cannot imagine the problem concretely.

**Takumi Ueno:** You cannot imagine the problem of what kind of differences arise at that time. Mm-hmm.

### **00:16:53**

**Eitaro Yamatsuta:** Right, and...

**Takumi Ueno:** The important thing is that I feel like things like converting PowerPoint can be done with Codex.

**Eitaro Yamatsuta:** You said that converting PowerPoint or similar things can be done with Claude Code or Codex, and I feel like it can actually already be done.

**Takumi Ueno:** Mm-hmm. Mm-hmm.

**Eitaro Yamatsuta:** So I wonder where the technical leap is.

**Takumi Ueno:** Where is the technical leap? Something like that.

**Eitaro Yamatsuta:** If you tell it to recognize images and properly read illustrations too, it seems like it would do it.

**Takumi Ueno:** It seems like if you tell it to read the images properly, it would do it.

**Eitaro Yamatsuta:** Mm-hmm.

**Takumi Ueno:** That is one thought.

**Eitaro Yamatsuta:** That is one thought. And which of the three was the government-office one?

**Takumi Ueno:** Which one was the city-office one? The government-office one is number two.

**Eitaro Yamatsuta:** It goes into the second of the three.

**Takumi Ueno:** Yes, the documents needed are shown according to the person.

**Eitaro Yamatsuta:** According to the person, yes, that is right. Mm-hmm.

**Takumi Ueno:** I was thinking about this. You work at a large company, right? In large companies, even if technically Claude Code can be used, is there still some kind of barrier to adoption?

### **00:17:45**

**Eitaro Yamatsuta:** I see. In large companies, even if Claude Code is technically possible, is there still a barrier to using it? Yes.

**Takumi Ueno:** Yes. Or rather, at my company, Codex is distributed, and...

**Eitaro Yamatsuta:** At my company, Codex is distributed, and you do up to the specifications. What are you building?

**Takumi Ueno:** We do up to internal specification design. What are we building? We are building an IoT system for remotely monitoring and operating air conditioners and large systems.

**Hayato Toyoda:** We do an ICT system.

**Takumi Ueno:** It is an ICT system, but internal specifications...

**Hayato Toyoda:** We do up to internal specification design, but specification design and everything from implementation onward...

**Takumi Ueno:** ...is all outsourced. And the amount of money is quite large: hundreds of millions, billions, tens of billions of yen...

**Hayato Toyoda:** We are trying to bring that part in-house and do implementation and testing with AI. But in practice, AI reads Word documents and PowerPoints, and, as Eitaro-san said, with Codex it seems like it should be possible. But in reality, it still does not quite read the contextual information properly. So, for example, when we ask it to convert...

### **00:19:32**

**Hayato Toyoda:** ...and then look at the converted MD file, even with Word documents written in a base format, information is still a little...

**Takumi Ueno:** ...missing.

**Hayato Toyoda:** It does not understand the meaning of tables, or...

**Takumi Ueno:** ...things are omitted, and in the end...

**Hayato Toyoda:** ...a person still has to correct it and do that kind of work.

**Takumi Ueno:** Yes.

**Hayato Toyoda:** The issue is that it cannot smoothly convert the information that can be read from the original picture into a form that AI can read.

**Takumi Ueno:** Mm-hmm. Can you provide the source data for this hackathon?

**Eitaro Yamatsuta:** Can you provide it for the hackathon?

**Takumi Ueno:** No, we cannot. We cannot.

**Eitaro Yamatsuta:** If not, it still feels like the problem statements we have presented could be grouped together. We could convert that into Markdown or a presentation-like, searchable, lightweight browser...

**Takumi Ueno:** I also feel that the problems and solution ideas we have presented are somewhat connected. We could convert things into Markdown or something like a presentation, create a searchable, lightweight browser, and for the appropriate output part, format it into each format, such as government-office forms, accounting, and so on. Maybe we are just broadly touching the foundation for AI, but it feels like there are definitely still missing pieces. That may be why adoption is not progressing in large enterprises, and why search is needed. I feel there is some missing part there, and that we are dealing with similar issues or solutions. If we dig deeper there, I feel there may be more. By the way, is the missing part the lightweight browser, or is the missing part the search technology?

### **00:21:11** {#00:21:11}

**Eitaro Yamatsuta:** What exactly is new in this lightweight conversion part? What part does not exist yet?

**Takumi Ueno:** What kind of part is it?

**Eitaro Yamatsuta:** No, I just thought that browsers now are for humans and contain a lot of waste.

**Takumi Ueno:** No, there is no time right now.

**Eitaro Yamatsuta:** Rather than feeling a specific pain now, if you make an agent search 10, 100, or 1,000 pages...

**Takumi Ueno:** Ah, if you make it search 10 browser pages and do research...

**Eitaro Yamatsuta:** ...the token table, or even something like that, fills up immediately. Yes. Yes. And if you make it do image recognition, too...

**Takumi Ueno:** Yes. Isn't there something like that? Ah, Firecrawl.

**Eitaro Yamatsuta:** Firecrawl.

**Takumi Ueno:** Firecrawl. An API.

**Eitaro Yamatsuta:** It renders sites as Markdown, something like that.

**Takumi Ueno:** When you give it a search query, it renders the website as Markdown and tells you, something like a conversion API.

**Eitaro Yamatsuta:** Something like an API.

**Takumi Ueno:** Yes, something like that.

**Eitaro Yamatsuta:** If every agent could use something like that...

**Takumi Ueno:** If we made that usable by all agents, it might work.

**Eitaro Yamatsuta:** It might work.

### **00:22:20**

**Takumi Ueno:** What? Yes, that is right. Actually, when ChatGPT searches...

**Eitaro Yamatsuta:** Actually, when it searches, what is...

**Takumi Ueno:** ...what is the blocker?

**Eitaro Yamatsuta:** What is the blocker? Where...

**Takumi Ueno:** By the way, when you say the slides are currently being given to an external vendor, is this for a project already underway that you want to take back to the AI side, or is it for future new projects? No, it is the current project that we want to take back using AI. And...

**Eitaro Yamatsuta:** And that...

**Takumi Ueno:** When you actually throw it into an LLM like Claude or Codex...

**Eitaro Yamatsuta:** [unclear]

**Hayato Toyoda:** It does convert it. In practice, the LLM interface calls a VLM, and...

**Takumi Ueno:** For PowerPoint, it converts the PowerPoint into a PDF...

**Eitaro Yamatsuta:** Um, four...

**Takumi Ueno:** ...then reads it with OCR.

**Eitaro Yamatsuta:** And for Word, you want it to read the file.

**Takumi Ueno:** It goes through a process like reading it and so on.

**Hayato Toyoda:** It reads the text data...

**Takumi Ueno:** ...and turns it into an MD file. And another...

### **00:23:40** {#00:23:40}

**Eitaro Yamatsuta:** And another...

**Takumi Ueno:** ...method is for these files, or Word files...

**Eitaro Yamatsuta:** [unclear]

**Hayato Toyoda:** There are actually OSS tools emerging that convert files into MD so that they become AI-readable. People are trying to do this, but when it is at enterprise scale, it is a specification document, and in the end there are still parts where AI does not understand the content properly, and people do not know where to check.

**Takumi Ueno:** So if there were an agent that could detect, for example, "the data here is broken"...

**Hayato Toyoda:** ...and, as you said, something similar to an information-checking process, where it prepares indicators like "information is missing here," then someone can go check and resolve those issues, and then...

**Takumi Ueno:** ...it gradually becomes AI-ready. By the way, how do you currently know that the context is wrong? Is it just hallucinating everywhere, or how can you tell? Ah, yes. For example, we write up to the external specification design, and based on that...

### **00:25:07**

**Hayato Toyoda:** ...the internal information is...

**Takumi Ueno:** You try to make it do something with that? How should I say it?

**Hayato Toyoda:** Right.

**Takumi Ueno:** Sometimes things are not properly documented in the first place.

**Hayato Toyoda:** Sometimes things are not documented properly, and the specification design may be missing prerequisite conditions that should have been included. So in large enterprises, when you try to process these specifications...

**Takumi Ueno:** It skips over things, producing designs that skip those parts, and then implementation...

**Hayato Toyoda:** They try to make it in operation, but it is not written in the specification. That kind of thing is becoming visible in this era of trying to use AI.

**Takumi Ueno:** So the issue is not only that hard PowerPoint files cannot be converted. Right. Conversion itself is a problem, and there is also tacit knowledge. Or rather, it is not exactly tacit knowledge...

**Hayato Toyoda:** There are so many documents that they have effectively become tacit knowledge.

**Takumi Ueno:** There is tacit knowledge, and there are things not written in this specification, but mentioned in some other related document.

**Hayato Toyoda:** Yes, maybe it is not mentioned in this document but is written in another document. Mm-hmm. Mm-hmm. Mm-hmm.

**Takumi Ueno:** The information remains in some form, but it is still difficult. Well, this area...

**Eitaro Yamatsuta:** This area can overlap.

### **00:27:05** {#00:27:05}

**Takumi Ueno:** This area can overlap, or we could go in a completely different direction that has not appeared here yet. Since the four of us are doing this, I think it would be interesting as a team if we approach something that all four of us commonly care about. In summary, either the company-related direction is worth exploring further, or we can solve a completely different problem. What I suggested was: why don't we find a common problem and solve something we are passionate about? This is a brainstorm session right now. Mm-hmm. I think so. I think any problem with this kind of thing is... Yeah, I really like this idea. Right now, no Japanese enterprise companies are using AI in that context. So I think there is a gap there. Maybe there might be a gap there. What do you think? Make it so easy to do anything. Other companies, websites, maybe need upload, maybe login, I do not know. Whatever tools they use, make it as easy as possible for them so they can use AI without a process. They do not care about the web. If you want to make it super easy for traditional companies, that user is just... Yeah. I think we are getting to the point here. So what would the MVP be for this? Are you guys all good with the idea that we are going to do this, or do you...

### **00:32:30**

**Takumi Ueno:** If there is another direction, that is fine too, but if we proceed with this direction, of course, for Hayato-san, we would want him to make PowerPoint materials, because he uses them often, and documents often circulate. We cannot send them out as-is because that would cause problems. But if we could convert them, that would show the value of the conversion tool. Yes. There are many intense consulting materials made for Japanese ministries and agencies. Really intense. Yes, yes, yes. "God Excel" is definitely a thing. "God PowerPoint" too. Ah, "God Excel" is good. Take a merged-cell Excel sheet and put it into ODX or something, and show how much is missing. That would show that our conversion...

**Eitaro Yamatsuta:** ...shows that things are not being captured, and that our conversion tool...

**Takumi Ueno:** Hack is the best. I HTML...

**Eitaro Yamatsuta:** HTML, XML, JSON.

**Takumi Ueno:** Um...

**Eitaro Yamatsuta:** Mm-hmm.

**Takumi Ueno:** Mm-hmm.

**Eitaro Yamatsuta:** Easy to make.

**Takumi Ueno:** If you could send things like that to Slack, that would be great. Excel, PowerPoint. Mm-hmm. Mm-hmm. Mm-hmm. Mm-hmm. Mm-hmm. Have to worry...

### **00:35:59**

**Takumi Ueno:** ...about Japan-specific skill, PR. Hayato-san, PDF. But what is this actually? It is a document for explaining to management, but is it a specification? Ah, there is one. Yes.

**Eitaro Yamatsuta:** Specification, yes.

**Takumi Ueno:** Specification. Mm-hmm.

**Eitaro Yamatsuta:** And a graph like this...

**Takumi Ueno:** Something like this is not very common, right?

**Eitaro Yamatsuta:** It is not very common, but something like this, with percentages...

**Takumi Ueno:** Three percent, but...

**Eitaro Yamatsuta:** Speaking of tools like this...

**Hayato Toyoda:** In terms of tools like this, there is an AWS...

**Eitaro Yamatsuta:** Service...

**Hayato Toyoda:** ...diagram showing the dependencies of AWS services and each... For example, our company's service uses a microservices architecture, but apart from the AWS relationships, there are dependencies between services and object dependencies. The documents have become so complex that even humans cannot read them. In the end, there are only about two people who understand them, and we have no choice but to ask those people.

**Eitaro Yamatsuta:** By the way, could you share your screen briefly? No, this is that... personal.

**Takumi Ueno:** Could you briefly show it by screen sharing? No, this is personal...

### **00:38:39** {#00:38:39}

**Hayato Toyoda:** By the way, it is hard to explain.

**Takumi Ueno:** PC.

**Eitaro Yamatsuta:** Personal. For example, really...

**Takumi Ueno:** [unclear]

**Hayato Toyoda:** For example...

**Takumi Ueno:** There are so many things connected that unrelated things are connected together.

**Eitaro Yamatsuta:** An enormous amount.

**Takumi Ueno:** By the way, documents like that usually have a name, right?

**Eitaro Yamatsuta:** They usually have a document name, something-something, right? Could we Google it and find a sample?

**Takumi Ueno:** It has a name, like a document setting document or something. It would be nice if we could find a sample by Googling it. Something we can use for work.

**Hayato Toyoda:** Generally, that is fine.

**Eitaro Yamatsuta:** Something like that. But this...

**Takumi Ueno:** Generally. Generally, it is one of the best in our company, so it can probably be shared after removing sensitive parts.

**Hayato Toyoda:** Okay.

**Eitaro Yamatsuta:** But the part where overall coordination with the system is needed may be good to look at specifically.

**Takumi Ueno:** Specifically. Which one? Which one?

**Eitaro Yamatsuta:** Um, the one where cards are shown on the card-like diagram.

**Takumi Ueno:** Ah, that page. Ah...

**Eitaro Yamatsuta:** I do not know what it is. Seven...

**Takumi Ueno:** I do not know what it is.

**Eitaro Yamatsuta:** Page. Ah, page 7. Number seven.

### **00:40:05**

**Takumi Ueno:** But even now...

**Eitaro Yamatsuta:** This kind of thing is definitely hard. Can it be done correctly?

**Takumi Ueno:** I wonder if it can.

**Eitaro Yamatsuta:** It would be good if it could be converted into Mermaid or something.

**Takumi Ueno:** Mermaid. This certainly does not seem understandable with the current tools.

**Eitaro Yamatsuta:** This definitely...

**Takumi Ueno:** It does not seem like it would understand.

**Eitaro Yamatsuta:** What would happen if we asked it to turn this into Mermaid and just threw page 7 in? Did you do it now?

**Takumi Ueno:** I am trying it now.

**Eitaro Yamatsuta:** AWS diagrams and similar things have traditionally been drawn in Draw.io, right?

**Takumi Ueno:** Draw...

**Eitaro Yamatsuta:** The graph itself is messy and unreadable to humans, but who wrote what, using what tool...

**Takumi Ueno:** No, it has basically become a river of additions. Now...

**Hayato Toyoda:** They treat the current version as absolutely correct, and whenever there is a spec change or a change between services, they only change that part or add to that part. As a result, it has become messy.

**Eitaro Yamatsuta:** So above that...

**Hayato Toyoda:** Like this.

**Takumi Ueno:** Conversely, from the engineer side...

**Eitaro Yamatsuta:** Conversely, is it now going backward from there?

**Takumi Ueno:** The engine side is also trying to do it, but...

### **00:41:49**

**Hayato Toyoda:** ...but until now, the large-enterprise team has only handled up to external specification design.

**Eitaro Yamatsuta:** Even if they try to do that...

**Hayato Toyoda:** Because the specifications are also bloated, the team alone cannot do it well. But even if an engineer who can read code properly is involved, to be honest, people like me do it while looking at the documents without looking at the code. In the end, because the code cannot be read, there is a situation where the documents have to be tested as if they are absolutely correct.

**Eitaro Yamatsuta:** What are the specifications for, then? Exactly.

**Takumi Ueno:** It is like the document is handed to the test team.

**Eitaro Yamatsuta:** The document is the premise, so they have it.

**Takumi Ueno:** I tried having Gemini convert it into Mermaid now.

**Eitaro Yamatsuta:** You had it converted today too. It produced something that looks plausible, but checking whether it is actually correct is extremely hard.

**Takumi Ueno:** It produced something plausible at a glance. Checking whether it is correct is very hard.

**Eitaro Yamatsuta:** Yes.

**Takumi Ueno:** Even GitHub might be difficult there.

**Eitaro Yamatsuta:** This...

**Takumi Ueno:** Converting, man, if not like GPT...

**Eitaro Yamatsuta:** One thing I...

**Takumi Ueno:** ...is for us to figure out if this...

**Eitaro Yamatsuta:** G...

### **00:44:05** {#00:44:05}

**Takumi Ueno:** That is exactly the kind of thing, like linking materials that the sales side has...

**Hayato Toyoda:** Ah.

**Takumi Ueno:** Mm-hmm.

**Hayato Toyoda:** [unclear]

**Eitaro Yamatsuta:** eng...

**Takumi Ueno:** Mm-hmm.

**Eitaro Yamatsuta:** It is really hard for a good...

**Takumi Ueno:** gener...

**Eitaro Yamatsuta:** Maybe...

**Takumi Ueno:** may...

**Hayato Toyoda:** [unclear]

**Eitaro Yamatsuta:** is power...

**Takumi Ueno:** con PowerPoint. Hmm, problem understanding.

**Eitaro Yamatsuta:** HTML, understanding that.

**Takumi Ueno:** That is... Mm-hmm.

**Eitaro Yamatsuta:** Mm-hmm.

**Takumi Ueno:** Mm-hmm. Mm-hmm.

**Eitaro Yamatsuta:** The great selling point is the second...

**Takumi Ueno:** I think the old...

**Hayato Toyoda:** Transforming is the most...

**Takumi Ueno:** Mm-hmm.

**Hayato Toyoda:** Um...

**Takumi Ueno:** Japanese is fine.

**Eitaro Yamatsuta:** The converted...

**Takumi Ueno:** The conversion engine.

**Eitaro Yamatsuta:** The conversion engine, or...

**Hayato Toyoda:** ...and so on, is probably the number-one gap...

**Eitaro Yamatsuta:** The conversion itself, as discussed...

**Hayato Toyoda:** There are already quite a few existing things for the conversion itself, so the issue is that the converted output is...

**Takumi Ueno:** ...not correct, or hard to see. For example, the converted specification...

**Hayato Toyoda:** Like this.

**Eitaro Yamatsuta:** Incorrect.

### **00:48:55**

**Hayato Toyoda:** How to fix it is a concern.

**Eitaro Yamatsuta:** And as...

**Takumi Ueno:** Conversion...

**Hayato Toyoda:** If there is an incorrect part, how to correct it or add to it, that part is the issue.

**Takumi Ueno:** The converted thing, how should I say it? The part is forced, or...

**Eitaro Yamatsuta:** A tool that sees whether the converted thing is really good.

**Takumi Ueno:** Something that sees whether the converted thing is good, and also something that can correct it.

**Eitaro Yamatsuta:** There is no platform for correcting it.

**Takumi Ueno:** Yes, exactly. You have to go and check it one by one.

**Hayato Toyoda:** You have to check it one by one.

**Takumi Ueno:** For example, even if you want to correct it, for Mermaid you need to know the notation, or for Draw.io you need to know the notation, or if you ask AI in a text-based way...

**Eitaro Yamatsuta:** For example, if you are correcting Mermaid, yes.

**Takumi Ueno:** Asking AI to do it is also hard to communicate. You have to verify each number one by one, so if it could collectively...

**Eitaro Yamatsuta:** [unclear]

**Hayato Toyoda:** ...find places where information is unclear or obviously broken and show something like, "this needs to be fixed," then...

### **00:50:22**

**Eitaro Yamatsuta:** ...it could show that...

**Hayato Toyoda:** For example, if you click it, you can see it, correct it there, press OK, and it also modifies the specification or the converted output. That would be nice, I think. Personally, I think that kind of thing would be good. We are not responsible for the accuracy itself.

**Takumi Ueno:** And, Taro-san...

**Eitaro Yamatsuta:** You are not doing the accuracy?

**Takumi Ueno:** Ah, regarding the existing conversion...

**Hayato Toyoda:** Since there are existing LLMs and OSS conversion engines, we are not trying to improve that accuracy itself. But one thing we may do is adjust the output so that it is easier for humans to read, rather than being in a form that is hard for humans to read.

**Takumi Ueno:** Right.

**Hayato Toyoda:** Then, from there, there is verification of whether the output is correct, and...

**Eitaro Yamatsuta:** ...whether it is correct. There is no verification and correction.

**Hayato Toyoda:** There is no easy interface for correction after verification. If we fill that gap, that is what I was imagining. That is just my idea.

### **00:51:37** {#00:51:37}

**Eitaro Yamatsuta:** Ah, there...

**Takumi Ueno:** There were three that were somewhat close.

**Hayato Toyoda:** Ja.

**Takumi Ueno:** First...

**Hayato Toyoda:** Like transform do are...

**Takumi Ueno:** Uh...

**Hayato Toyoda:** growing that. Yes.

**Eitaro Yamatsuta:** Yes.

**Takumi Ueno:** Let us make HTML.

**Eitaro Yamatsuta:** HTML. How did you do this?

**Takumi Ueno:** How did you do this?

**Eitaro Yamatsuta:** I asked Codex to make it HTML, not Mermaid.

**Takumi Ueno:** Amazing.

**Eitaro Yamatsuta:** It seems to have generated it as SVG.

**Takumi Ueno:** Wow, it can create arrows too.

**Hayato Toyoda:** Ah.

**Takumi Ueno:** This also does not seem correct.

**Eitaro Yamatsuta:** There was no mistake? Ah, I see.

**Takumi Ueno:** I think...

**Hayato Toyoda:** All right.

**Takumi Ueno:** If we find something like that... Mm-hmm. Can it be corrected?

**Eitaro Yamatsuta:** Mm-hmm. It can be regenerated.

**Hayato Toyoda:** It was made.

**Takumi Ueno:** How about you?

**Eitaro Yamatsuta:** But does that mean we should just have it output to Draw.io? Then the UI...

**Hayato Toyoda:** Ah.

**Takumi Ueno:** Since people do not understand Mermaid...

**Eitaro Yamatsuta:** If there are people who do not understand Mermaid...

### **00:55:21** {#00:55:21}

**Takumi Ueno:** ...and they want to do it with a GUI for followers...

**Eitaro Yamatsuta:** If they want to do it with a GUI, then isn't Draw.io fine?

**Hayato Toyoda:** Right.

**Takumi Ueno:** Also, if humans have to enter at the end anyway...

**Eitaro Yamatsuta:** If humans have to enter at the end anyway, I feel like it may not improve efficiency that much.

**Hayato Toyoda:** [unclear]

**Takumi Ueno:** By...

**Eitaro Yamatsuta:** And you can really can eas...

**Takumi Ueno:** Maybe. Why is that?

**Hayato Toyoda:** I think...

**Takumi Ueno:** Touch just making...

**Eitaro Yamatsuta:** A...

**Hayato Toyoda:** I am...

**Takumi Ueno:** A file, but people, engineer...

**Hayato Toyoda:** [unclear]

**Takumi Ueno:** Platform. House for... For example, when you input various kinds of text, it is completely okay...

**Eitaro Yamatsuta:** When you input various things, graphs and things like that are also probably okay to some extent, but for graphs, maybe Draw.io is better for correction. If it is receipts, a different interface may be better. For many different images, or areas other than text, there is no interface for correctly correcting them...

**Takumi Ueno:** There is no all-in-one interface...

**Rami Naeem:** Problems like this are occurring...

### **00:59:09** {#00:59:09}

**Takumi Ueno:** I felt that these problems are happening because of that. Yes, exactly. Would it be good to have that? My personal thought is that, as long as we are still in a world where AI models fully understanding context is beyond the horizon, but we nevertheless need them to understand accurately right now, we need a UI/UX where humans can intervene. Since there is no single tool that can apply this across many media types and formats, such as Excel and others, I thought it would be good to have one. I think building that kind of web app could be our output. Mm-hmm. That was my personal thought. What do you think? No, I agree with that. Translation: having all presentations, and we do not have a specific UI; we have to have a specific UI for each use case, like Draw.io, Mermaid, and all that, but there is no integrated platform. Yes. And it will move on to the company brain. Yeah. Yeah. Perfect. And I...

**Hayato Toyoda:** To add to what Takumi-san said, when people try to turn existing specifications into a form that AI can read, they do not have the process for what steps to take and how to do it. I think that is why this problem is happening. So I think it would be good to make the platform one that can also provide the process know-how.

### **01:02:25** {#01:02:25}

**Takumi Ueno:** That is very good. Just on schedule, I think we have the MVP idea. Oh, V2 HMO. If we swap these, it definitely becomes easier to see. I see. When I am using this kind of map... PDF, all we need for... I think the more important impact is not, for example, whether we use AWS as infrastructure. The system architecture is not really important. I think the actual output, the outcome of the thing, is more important. What we have to present, the output, even if it is a local server, that is fine. What do we want to show? Mm-hmm. Mm-hmm. Mm-hmm. Mm-hmm. What do we want on the page? When I said that, the fixing UI for non-engineers to fix images, PowerPoint to MD, and people in MD... For Excel, maybe a person can send a PDF or random PowerPoint, and it will be automatically converted. But for images like these ones, they have this UI to see, "It could be 80% correct, but I am not sure about the rest. Can you fix it?" Mm-hmm. Mm-hmm. Mm-hmm. Yeah. That product is, I think, what we need to build. That will solve many problems that we have. Are you guys hungry? Before we [unclear], maybe we close this Google Meet.

**Eitaro Yamatsuta:** From right and let.

### **Transcript ended after 01:21:59**

*This editable transcript was computer-generated and may contain errors. The generated text can be edited.*

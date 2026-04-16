package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.entity.UserProfile;
import com.example.demo.repository.UserProfileRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserProfileRepository profileRepository;
    private final UserRepository userRepository;

    @Transactional
    public Optional<UserProfile> getProfileByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(user -> profileRepository.findById(user.getId())
                        .orElseGet(() -> {
                            UserProfile defaultProfile = new UserProfile();
                            defaultProfile.setUser(user);
                            defaultProfile.setId(user.getId());
                            defaultProfile.setNewProfile(true);
                            return profileRepository.save(defaultProfile);
                        }));
    }

    @Transactional
    public UserProfile saveProfile(String email, UserProfile updatedProfile) {
        System.out.println("DEBUG: Saving profile for email: [" + email + "]");
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));

        // Pobierz istniejący profil lub utwórz nowy
        UserProfile existing = profileRepository.findById(user.getId())
                .orElseGet(() -> {
                    UserProfile np = new UserProfile();
                    np.setUser(user);
                    np.setId(user.getId());
                    np.setNewProfile(true);
                    return np;
                });

        // Kopiowanie tylko nie-null pól (Manual Merge)
        if (updatedProfile.getDisplayName() != null) {
            String d = updatedProfile.getDisplayName().trim();
            existing.setDisplayName(d.isEmpty() ? null : d);
        }
        if (updatedProfile.getGender() != null) existing.setGender(updatedProfile.getGender());
        if (updatedProfile.getAge() != null) existing.setAge(updatedProfile.getAge());
        if (updatedProfile.getWeight() != null) existing.setWeight(updatedProfile.getWeight());
        if (updatedProfile.getHeight() != null) existing.setHeight(updatedProfile.getHeight());
        if (updatedProfile.getTargetWeight() != null) existing.setTargetWeight(updatedProfile.getTargetWeight());
        if (updatedProfile.getLifestyleActivity() != null) existing.setLifestyleActivity(updatedProfile.getLifestyleActivity());
        if (updatedProfile.getExerciseActivity() != null) existing.setExerciseActivity(updatedProfile.getExerciseActivity());
        if (updatedProfile.getActivity() != null) existing.setActivity(updatedProfile.getActivity());
        if (updatedProfile.getGoal() != null) existing.setGoal(updatedProfile.getGoal());
        if (updatedProfile.getChangeSpeed() != null) existing.setChangeSpeed(updatedProfile.getChangeSpeed());
        if (updatedProfile.getIsManualMacros() != null) existing.setIsManualMacros(updatedProfile.getIsManualMacros());
        if (updatedProfile.getTargetKcal() != null) existing.setTargetKcal(updatedProfile.getTargetKcal());
        if (updatedProfile.getTargetProtein() != null) existing.setTargetProtein(updatedProfile.getTargetProtein());
        if (updatedProfile.getTargetFat() != null) existing.setTargetFat(updatedProfile.getTargetFat());
        if (updatedProfile.getTargetCarbs() != null) existing.setTargetCarbs(updatedProfile.getTargetCarbs());
        if (updatedProfile.getTargetProteinMin() != null) existing.setTargetProteinMin(updatedProfile.getTargetProteinMin());
        if (updatedProfile.getTargetProteinMax() != null) existing.setTargetProteinMax(updatedProfile.getTargetProteinMax());
        if (updatedProfile.getTargetFatMin() != null) existing.setTargetFatMin(updatedProfile.getTargetFatMin());
        if (updatedProfile.getTargetFatMax() != null) existing.setTargetFatMax(updatedProfile.getTargetFatMax());
        if (updatedProfile.getTargetCarbsMin() != null) existing.setTargetCarbsMin(updatedProfile.getTargetCarbsMin());
        if (updatedProfile.getTargetCarbsMax() != null) existing.setTargetCarbsMax(updatedProfile.getTargetCarbsMax());
        if (updatedProfile.getMealConfig() != null) existing.setMealConfig(updatedProfile.getMealConfig());
        if (updatedProfile.getVisibleMeals() != null) existing.setVisibleMeals(updatedProfile.getVisibleMeals());

        return profileRepository.save(existing);
    }
}
